<?php
/**
 * list-posts.php - Fetches posts from database with all associated field values
 * Returns posts in format compatible with frontend getAllPostsCache()
 */

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
  if (is_file($candidate)) {
    $configPath = $candidate;
    break;
  }
}

if ($configPath === null) {
  throw new RuntimeException('Database configuration file is missing.');
}

require_once $configPath;

$authCandidates = [
  __DIR__ . '/../config/config-auth.php',
  dirname(__DIR__) . '/config/config-auth.php',
  dirname(__DIR__, 2) . '/config/config-auth.php',
  dirname(__DIR__, 3) . '/../config/config-auth.php',
  dirname(__DIR__) . '/../config/config-auth.php',
  __DIR__ . '/config-auth.php',
];

$authPath = null;
foreach ($authCandidates as $candidate) {
  if (is_file($candidate)) {
    $authPath = $candidate;
    break;
  }
}

if ($authPath !== null) {
  require_once $authPath;
}

header('Content-Type: application/json');

// Check if called via gateway (no auth needed) or direct (auth required)
$viaGateway = defined('FUNMAP_GATEWAY_ACTIVE') && FUNMAP_GATEWAY_ACTIVE === true;

if (!$viaGateway) {
  if (!function_exists('verify_api_key') || !verify_api_key($_SERVER['HTTP_X_API_KEY'] ?? '')) {
    http_response_code(403);
    exit(json_encode(['success' => false, 'error' => 'Forbidden']));
  }
}

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
  http_response_code(500);
  exit(json_encode(['success' => false, 'error' => 'Database connection unavailable.']));
}

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug($text) {
  if (!is_string($text) || trim($text) === '') {
    return '';
  }
  $text = strtolower(trim($text));
  $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
  $text = preg_replace('/[\s-]+/', '-', $text);
  return trim($text, '-');
}

/**
 * Format date for frontend (ISO format with dashes instead of colons/dots)
 */
function formatCreatedDate($dateStr) {
  if (!$dateStr) {
    return date('Y-m-d\TH-i-s-000\Z');
  }
  $timestamp = strtotime($dateStr);
  if ($timestamp === false) {
    return date('Y-m-d\TH-i-s-000\Z');
  }
  return date('Y-m-d\TH-i-s-000\Z', $timestamp);
}

// Parse optional query parameters
$limit = isset($_GET['limit']) ? max(1, min(10000, (int)$_GET['limit'])) : 1000;
$offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
$status = isset($_GET['status']) ? trim($_GET['status']) : 'active';

// Build query to fetch posts with subcategory/category info
// The posts table may have different column names depending on schema version
// We'll query what's available and handle missing columns gracefully

$postsQuery = "
  SELECT 
    p.id,
    p.member_id,
    p.member_name,
    p.created_at,
    p.updated_at,
    s.id as subcategory_id,
    s.subcategory_name,
    s.category_id,
    s.category_name,
    s.icon_path as subcategory_icon
  FROM posts p
  LEFT JOIN subcategories s ON p.subcategory_key = s.subcategory_key
  ORDER BY p.created_at DESC
  LIMIT ? OFFSET ?
";

// Try to detect if posts table has title and status columns
$hasTitle = false;
$hasStatus = false;

$columnsResult = $mysqli->query("SHOW COLUMNS FROM posts");
if ($columnsResult) {
  while ($col = $columnsResult->fetch_assoc()) {
    $colName = strtolower($col['Field']);
    if ($colName === 'title') $hasTitle = true;
    if ($colName === 'status') $hasStatus = true;
    if ($colName === 'visibility') $hasStatus = true; // Alternative column name
  }
  $columnsResult->free();
}

// Build dynamic query based on available columns
$selectCols = [
  'p.id',
  'p.member_id',
  'p.member_name',
  'p.created_at',
  'p.updated_at'
];

if ($hasTitle) {
  $selectCols[] = 'p.title';
}
if ($hasStatus) {
  $selectCols[] = 'COALESCE(p.status, p.visibility) as status';
}

$postsQuery = "
  SELECT 
    " . implode(",\n    ", $selectCols) . ",
    s.id as subcategory_id,
    s.subcategory_name,
    s.category_id,
    s.category_name,
    s.icon_path as subcategory_icon,
    c.icon_path as category_icon
  FROM posts p
  LEFT JOIN subcategories s ON p.subcategory_key = s.subcategory_key
  LEFT JOIN categories c ON s.category_id = c.id
  ORDER BY p.created_at DESC
  LIMIT ? OFFSET ?
";

$stmt = $mysqli->prepare($postsQuery);
if (!$stmt) {
  // Fallback to simpler query if join fails
  $stmt = $mysqli->prepare("SELECT id, member_id, member_name, created_at FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?");
  if (!$stmt) {
    http_response_code(500);
    exit(json_encode(['success' => false, 'error' => 'Failed to prepare posts query: ' . $mysqli->error]));
  }
}

$stmt->bind_param('ii', $limit, $offset);
if (!$stmt->execute()) {
  http_response_code(500);
  exit(json_encode(['success' => false, 'error' => 'Failed to execute posts query.']));
}

$result = $stmt->get_result();
$postsRaw = [];
$postIds = [];

while ($row = $result->fetch_assoc()) {
  $postIds[] = (int)$row['id'];
  $postsRaw[(int)$row['id']] = $row;
}
$stmt->close();

// If no posts, return empty array
if (empty($postIds)) {
  echo json_encode(['success' => true, 'posts' => []]);
  exit;
}

// Fetch field values for all posts in one query
$fieldValues = [];
$placeholders = implode(',', array_fill(0, count($postIds), '?'));
$types = str_repeat('i', count($postIds));

// Check if field_values table exists
$tableCheck = $mysqli->query("SHOW TABLES LIKE 'field_values'");
$hasFieldValues = $tableCheck && $tableCheck->num_rows > 0;

if ($hasFieldValues) {
  $fieldsQuery = "SELECT post_id, field_id, field_label, value FROM field_values WHERE post_id IN ($placeholders)";
  $fieldsStmt = $mysqli->prepare($fieldsQuery);
  
  if ($fieldsStmt) {
    $fieldsStmt->bind_param($types, ...$postIds);
    if ($fieldsStmt->execute()) {
      $fieldsResult = $fieldsStmt->get_result();
      while ($row = $fieldsResult->fetch_assoc()) {
        $postId = (int)$row['post_id'];
        if (!isset($fieldValues[$postId])) {
          $fieldValues[$postId] = [];
        }
        $fieldValues[$postId][] = [
          'id' => $row['field_id'],
          'label' => $row['field_label'],
          'value' => $row['value']
        ];
      }
    }
    $fieldsStmt->close();
  }
}

// Also check for post_locations table for coordinate data
$hasLocations = false;
$locationCheck = $mysqli->query("SHOW TABLES LIKE 'post_locations'");
$hasLocations = $locationCheck && $locationCheck->num_rows > 0;

$locationData = [];
if ($hasLocations) {
  $locQuery = "SELECT post_id, latitude, longitude, address, venue_name FROM post_locations WHERE post_id IN ($placeholders)";
  $locStmt = $mysqli->prepare($locQuery);
  if ($locStmt) {
    $locStmt->bind_param($types, ...$postIds);
    if ($locStmt->execute()) {
      $locResult = $locStmt->get_result();
      while ($row = $locResult->fetch_assoc()) {
        $postId = (int)$row['post_id'];
        if (!isset($locationData[$postId])) {
          $locationData[$postId] = [];
        }
        $locationData[$postId][] = $row;
      }
    }
    $locStmt->close();
  }
}

// Build frontend-compatible post objects
$posts = [];
foreach ($postsRaw as $postId => $postData) {
  $fields = $fieldValues[$postId] ?? [];
  $locations = $locationData[$postId] ?? [];
  
  // Extract key fields from field_values
  $title = $postData['title'] ?? '';
  $description = '';
  $postLng = null;
  $postLat = null;
  $postAddress = '';
  $images = [];
  
  foreach ($fields as $field) {
    $label = strtolower($field['label'] ?? '');
    $value = $field['value'] ?? '';
    
    // Try to detect field types by label
    if (strpos($label, 'title') !== false && empty($title)) {
      $title = $value;
    } elseif (strpos($label, 'description') !== false || strpos($label, 'desc') !== false) {
      $description = $value;
    } elseif (strpos($label, 'image') !== false || strpos($label, 'photo') !== false) {
      // Images might be JSON array or single value
      $decoded = json_decode($value, true);
      if (is_array($decoded)) {
        $images = array_merge($images, $decoded);
      } elseif (!empty($value)) {
        $images[] = $value;
      }
    } elseif (strpos($label, 'location') !== false) {
      // Location might be JSON with lat/lng/address
      $decoded = json_decode($value, true);
      if (is_array($decoded)) {
        if (isset($decoded['latitude'])) $postLat = (float)$decoded['latitude'];
        if (isset($decoded['longitude'])) $postLng = (float)$decoded['longitude'];
        if (isset($decoded['address'])) $postAddress = $decoded['address'];
      }
    }
  }
  
  // Use location data from post_locations table if available
  if (!empty($locations)) {
    $firstLoc = $locations[0];
    if ($postLat === null && isset($firstLoc['latitude'])) {
      $postLat = (float)$firstLoc['latitude'];
    }
    if ($postLng === null && isset($firstLoc['longitude'])) {
      $postLng = (float)$firstLoc['longitude'];
    }
    if (empty($postAddress) && isset($firstLoc['address'])) {
      $postAddress = $firstLoc['address'];
    }
  }
  
  // Generate slug from title
  $slug = generateSlug($title ?: 'post-' . $postId);
  
  // Build locations array in frontend format
  $frontendLocations = [];
  if ($postLat !== null && $postLng !== null) {
    $frontendLocations[] = [
      'lng' => $postLng,
      'lat' => $postLat,
      'name' => $postAddress ?: 'Location',
      'address' => $postAddress,
      'dates' => [] // Will be populated if we have session/date data
    ];
  }
  
  // Build the post object matching frontend expectations
  $post = [
    'id' => $postId,
    'title' => $title ?: 'Untitled Post',
    'slug' => $slug,
    'created' => formatCreatedDate($postData['created_at']),
    'city' => $postAddress ? explode(',', $postAddress)[0] : '',
    'lng' => $postLng,
    'lat' => $postLat,
    'category' => $postData['category_name'] ?? '',
    'subcategory' => [
      'id' => $postData['subcategory_id'] ?? null,
      'name' => $postData['subcategory_name'] ?? ''
    ],
    'dates' => [], // TODO: Derive from locations/sessions
    'sponsored' => false,
    'fav' => false,
    'desc' => $description,
    'images' => $images,
    'locations' => $frontendLocations,
    'member' => [
      'id' => $postData['member_id'] ?? null,
      'username' => $postData['member_name'] ?? 'Anonymous',
      'avatar' => '' // TODO: Fetch from members table if needed
    ],
    'fields' => $fields // Include raw fields for flexibility
  ];
  
  $posts[] = $post;
}

echo json_encode(['success' => true, 'posts' => $posts]);
?>
