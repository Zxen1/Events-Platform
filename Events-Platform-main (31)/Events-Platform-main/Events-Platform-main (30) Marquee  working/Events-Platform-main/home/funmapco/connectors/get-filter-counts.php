<?php
/**
 * get-filter-counts.php
 *
 * Computes fast counts for:
 * - header "showing" count (worldwide when zoom < 8, in-area when zoom >= 8 and bounds provided)
 * - filter panel summary "X showing out of Y in the area"
 * - facet counts per subcategory (ignoring current subcategory selection, but respecting all other filters)
 *
 * IMPORTANT:
 * - Uses normalized tables for correctness (post_sessions / post_ticket_pricing / post_item_pricing).
 * - Never uses post_map_cards session_summary/price_summary/amenity_summary for filtering.
 */
declare(strict_types=1);

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

function fail(int $code, string $message): void {
  http_response_code($code);
  echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_SLASHES);
  exit;
}

function bind_params_array(mysqli_stmt $stmt, string $types, array &$params): bool
{
  if ($types === '') return true;
  $arguments = [$types];
  foreach ($params as $k => $v) {
    $arguments[] = &$params[$k];
  }
  return call_user_func_array([$stmt, 'bind_param'], $arguments);
}

try {
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    fail(405, 'Method not allowed');
  }

  $configCandidates = [
    __DIR__ . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 3) . '/../config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
    __DIR__ . '/config-db.php',
  ];

  $configPath = null;
  foreach ($configCandidates as $candidate) {
    if (is_file($candidate)) { $configPath = $candidate; break; }
  }
  if ($configPath === null) fail(500, 'Database configuration file is missing.');
  require_once $configPath;
  if (!isset($mysqli) || !($mysqli instanceof mysqli)) fail(500, 'Database connection unavailable.');

  $zoom = isset($_GET['zoom']) ? floatval($_GET['zoom']) : 0.0;
  $areaActive = ($zoom >= 8.0);

  // bounds: sw_lng,sw_lat,ne_lng,ne_lat (only used when areaActive)
  $bounds = null;
  if (!empty($_GET['bounds'])) {
    $parts = explode(',', (string)$_GET['bounds']);
    if (count($parts) === 4) {
      $bounds = [
        'sw_lng' => floatval($parts[0]),
        'sw_lat' => floatval($parts[1]),
        'ne_lng' => floatval($parts[2]),
        'ne_lat' => floatval($parts[3]),
      ];
    }
  }
  if (!$areaActive) {
    $bounds = null;
  }

  $keyword = isset($_GET['keyword']) ? trim((string)$_GET['keyword']) : '';
  $minPrice = isset($_GET['min_price']) && $_GET['min_price'] !== '' ? floatval($_GET['min_price']) : null;
  $maxPrice = isset($_GET['max_price']) && $_GET['max_price'] !== '' ? floatval($_GET['max_price']) : null;
  $dateStart = isset($_GET['date_start']) ? trim((string)$_GET['date_start']) : '';
  $dateEnd = isset($_GET['date_end']) ? trim((string)$_GET['date_end']) : '';
  $includeExpired = isset($_GET['expired']) && ((string)$_GET['expired'] === '1' || (string)$_GET['expired'] === 'true');

  // Subcategory selection (comma-separated subcategory_key)
  $subcategoryKeys = [];
  if (!empty($_GET['subcategory_keys'])) {
    $raw = explode(',', (string)$_GET['subcategory_keys']);
    foreach ($raw as $k) {
      $k = trim($k);
      if ($k !== '') $subcategoryKeys[] = $k;
    }
  }

  // Baseline (NOT user filters): visibility/moderation/payment/deleted only.
  // All counts are MAP CARDS (post_map_cards rows), not posts.
  $whereBaseline = [];
  $paramsBaseline = [];
  $typesBaseline = '';

  $whereBaseline[] = 'p.deleted_at IS NULL';
  $whereBaseline[] = 'p.payment_status = ?';
  $paramsBaseline[] = 'paid';
  $typesBaseline .= 's';

  if ($includeExpired) {
    $whereBaseline[] = 'p.visibility IN (?, ?)';
    $paramsBaseline[] = 'active';
    $paramsBaseline[] = 'expired';
    $typesBaseline .= 'ss';
  } else {
    $whereBaseline[] = 'p.visibility = ?';
    $paramsBaseline[] = 'active';
    $typesBaseline .= 's';
  }

  $whereBaseline[] = 'p.moderation_status IN (?, ?)';
  $paramsBaseline[] = 'clean';
  $paramsBaseline[] = 'pending';
  $typesBaseline .= 'ss';

  // Scope = baseline + (bounds if zoom>=8)
  $whereScope = $whereBaseline;
  $paramsScope = $paramsBaseline;
  $typesScope = $typesBaseline;
  if ($bounds !== null) {
    $whereScope[] = 'pmc.latitude BETWEEN ? AND ?';
    $whereScope[] = 'pmc.longitude BETWEEN ? AND ?';
    $paramsScope[] = $bounds['sw_lat'];
    $paramsScope[] = $bounds['ne_lat'];
    $paramsScope[] = $bounds['sw_lng'];
    $paramsScope[] = $bounds['ne_lng'];
    $typesScope .= 'dddd';
  }

  // User filters (excluding subcategory selection) apply on top of scope.
  $whereFiltered = $whereScope;
  $paramsFiltered = $paramsScope;
  $typesFiltered = $typesScope;

  if ($keyword !== '') {
    $kw = '%' . $keyword . '%';
    $whereFiltered[] = '(pmc.title LIKE ? OR pmc.description LIKE ? OR pmc.venue_name LIKE ? OR pmc.city LIKE ? OR p.checkout_title LIKE ?)';
    $paramsFiltered[] = $kw; $paramsFiltered[] = $kw; $paramsFiltered[] = $kw; $paramsFiltered[] = $kw; $paramsFiltered[] = $kw;
    $typesFiltered .= 'sssss';
  }

  if ($dateStart !== '' || $dateEnd !== '') {
    $start = $dateStart !== '' ? $dateStart : $dateEnd;
    $end = $dateEnd !== '' ? $dateEnd : $dateStart;
    if ($start === '' || $end === '') { $end = $start; }
    $whereFiltered[] = 'EXISTS (SELECT 1 FROM post_sessions ps WHERE ps.map_card_id = pmc.id AND ps.session_date BETWEEN ? AND ?)';
    $paramsFiltered[] = $start;
    $paramsFiltered[] = $end;
    $typesFiltered .= 'ss';
  }

  if ($minPrice !== null || $maxPrice !== null) {
    $min = $minPrice !== null ? $minPrice : null;
    $max = $maxPrice !== null ? $maxPrice : null;
    if ($min !== null && $max !== null) {
      $whereFiltered[] = '(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.map_card_id = pmc.id AND tp.price BETWEEN ? AND ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.map_card_id = pmc.id AND ip.item_price BETWEEN ? AND ?))';
      $paramsFiltered[] = $min; $paramsFiltered[] = $max; $paramsFiltered[] = $min; $paramsFiltered[] = $max;
      $typesFiltered .= 'dddd';
    } elseif ($min !== null) {
      $whereFiltered[] = '(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.map_card_id = pmc.id AND tp.price >= ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.map_card_id = pmc.id AND ip.item_price >= ?))';
      $paramsFiltered[] = $min; $paramsFiltered[] = $min;
      $typesFiltered .= 'dd';
    } elseif ($max !== null) {
      $whereFiltered[] = '(EXISTS (SELECT 1 FROM post_ticket_pricing tp WHERE tp.map_card_id = pmc.id AND tp.price <= ?) OR EXISTS (SELECT 1 FROM post_item_pricing ip WHERE ip.map_card_id = pmc.id AND ip.item_price <= ?))';
      $paramsFiltered[] = $max; $paramsFiltered[] = $max;
      $typesFiltered .= 'dd';
    }
  }

  // Selection (subcategory filter) applies only to "showing", not to facet counts.
  $whereSelection = [];
  $paramsSelection = [];
  $typesSelection = '';
  if (count($subcategoryKeys) > 0) {
    $placeholders = implode(',', array_fill(0, count($subcategoryKeys), '?'));
    $whereSelection[] = "pmc.subcategory_key IN ($placeholders)";
    foreach ($subcategoryKeys as $k) {
      $paramsSelection[] = $k;
      $typesSelection .= 's';
    }
  }

  $scopeWhereSql = implode(' AND ', $whereScope);
  $filteredWhereSql = implode(' AND ', $whereFiltered);
  $showingWhereSql = $filteredWhereSql . (count($whereSelection) ? (' AND ' . implode(' AND ', $whereSelection)) : '');

  // total_available: baseline only (plus scope bounds if zoom>=8)
  $totalAvailableSql = "
    SELECT COUNT(*) AS total
    FROM post_map_cards pmc
    INNER JOIN posts p ON pmc.post_id = p.id
    WHERE {$scopeWhereSql}
  ";
  $stmtAvail = $mysqli->prepare($totalAvailableSql);
  if (!$stmtAvail) fail(500, 'Prepare failed (total_available)');
  if ($typesScope !== '') {
    $paramsScopeBind = $paramsScope;
    bind_params_array($stmtAvail, $typesScope, $paramsScopeBind);
  }
  $stmtAvail->execute();
  $resAvail = $stmtAvail->get_result();
  $totalAvailable = $resAvail ? (int)($resAvail->fetch_assoc()['total'] ?? 0) : 0;
  $stmtAvail->close();

  // total_showing: baseline + user filters + selection (plus scope bounds if zoom>=8)
  $totalShowingSql = "
    SELECT COUNT(*) AS total
    FROM post_map_cards pmc
    INNER JOIN posts p ON pmc.post_id = p.id
    WHERE {$showingWhereSql}
  ";
  $stmtShow = $mysqli->prepare($totalShowingSql);
  if (!$stmtShow) fail(500, 'Prepare failed (total_showing)');

  $typesShow = $typesFiltered . $typesSelection;
  $paramsShow = array_merge($paramsFiltered, $paramsSelection);
  if ($typesShow !== '') {
    $paramsShowBind = $paramsShow;
    bind_params_array($stmtShow, $typesShow, $paramsShowBind);
  }
  $stmtShow->execute();
  $resShow = $stmtShow->get_result();
  $totalShowing = $resShow ? (int)($resShow->fetch_assoc()['total'] ?? 0) : 0;
  $stmtShow->close();

  // facet_subcategory_counts (current scope, ignore selection; respect all other filters)
  $facetSql = "
    SELECT pmc.subcategory_key AS subcategory_key, COUNT(*) AS total
    FROM post_map_cards pmc
    INNER JOIN posts p ON pmc.post_id = p.id
    WHERE {$filteredWhereSql}
    GROUP BY pmc.subcategory_key
  ";
  $stmtFacet = $mysqli->prepare($facetSql);
  if (!$stmtFacet) fail(500, 'Prepare failed (facet)');
  if ($typesFiltered !== '') {
    $paramsFilteredBind = $paramsFiltered;
    bind_params_array($stmtFacet, $typesFiltered, $paramsFilteredBind);
  }
  $stmtFacet->execute();
  $resFacet = $stmtFacet->get_result();
  $facet = [];
  if ($resFacet) {
    while ($row = $resFacet->fetch_assoc()) {
      $k = isset($row['subcategory_key']) ? (string)$row['subcategory_key'] : '';
      if ($k === '') continue;
      $facet[$k] = (int)($row['total'] ?? 0);
    }
  }
  $stmtFacet->close();

  echo json_encode([
    'success' => true,
    'area_active' => $bounds !== null,
    'total_available' => $totalAvailable,
    'total_showing' => $totalShowing,
    'facet_subcategories' => $facet,
  ], JSON_UNESCAPED_SLASHES);
  exit;
} catch (Throwable $e) {
  fail(500, 'Server error');
}


