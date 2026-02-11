<?php
/**
 * restore-post.php — Lists revisions and restores posts from snapshots.
 *
 * Two modes:
 *   LIST:    GET ?post_id=123&member_id=1&member_type=member
 *            Returns available restore points (no data_json — just metadata).
 *
 *   RESTORE: POST { "revision_id": 123, "member_id": 1, "member_type": "member" }
 *            Reads data_json, deletes current child-table data, re-inserts from snapshot.
 *            Resilient: skips columns that no longer exist, reports what was skipped.
 */

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
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
if ($configPath === null) {
  header('Content-Type: application/json');
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Database configuration missing']);
  exit;
}
require_once $configPath;

header('Content-Type: application/json');

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Database connection failed']);
  exit;
}

// ============================================================================
// MODE: LIST REVISIONS (GET request with post_id, no revision_id)
// ============================================================================
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
$isListMode = false;

// Detect list mode: GET params with post_id but no revision_id in body
if (!empty($_GET['post_id']) && (empty($data) || empty($data['revision_id']))) {
  $isListMode = true;
  $postId    = (int)$_GET['post_id'];
  $memberId  = isset($_GET['member_id']) ? (int)$_GET['member_id'] : 0;
  $memberType = isset($_GET['member_type']) ? trim((string)$_GET['member_type']) : 'member';
  $isAdmin   = strtolower($memberType) === 'admin';

  // Verify ownership
  $stmtOwner = $mysqli->prepare("SELECT member_id FROM posts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
  if (!$stmtOwner) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Query failed']);
    exit;
  }
  $stmtOwner->bind_param('i', $postId);
  $stmtOwner->execute();
  $stmtOwner->bind_result($postOwnerId);
  if (!$stmtOwner->fetch()) {
    $stmtOwner->close();
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Post not found']);
    exit;
  }
  $stmtOwner->close();

  if (!$isAdmin && (int)$postOwnerId !== $memberId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Permission denied']);
    exit;
  }

  // Fetch revisions — only restorable types (database row snapshots), newest first
  $stmt = $mysqli->prepare("SELECT id, post_title, editor_name, change_type, change_summary, created_at FROM post_revisions WHERE post_id = ? AND change_type IN ('create', 'edit') ORDER BY id DESC");
  if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Query failed']);
    exit;
  }
  $stmt->bind_param('i', $postId);
  $stmt->execute();
  $result = $stmt->get_result();

  $revisions = [];
  while ($row = $result->fetch_assoc()) {
    $revisions[] = [
      'id'             => (int)$row['id'],
      'post_title'     => $row['post_title'],
      'editor_name'    => $row['editor_name'],
      'change_type'    => $row['change_type'],
      'change_summary' => $row['change_summary'],
      'created_at'     => $row['created_at'],
    ];
  }
  $result->free();
  $stmt->close();

  echo json_encode(['success' => true, 'revisions' => $revisions], JSON_UNESCAPED_SLASHES);
  exit;
}

// ============================================================================
// MODE: RESTORE (POST request with revision_id)
// ============================================================================
if (!is_array($data) || empty($data['revision_id'])) {
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'Missing revision_id']);
  exit;
}

$revisionId = (int)$data['revision_id'];
$memberId   = isset($data['member_id']) ? (int)$data['member_id'] : 0;
$memberType = isset($data['member_type']) ? trim((string)$data['member_type']) : 'member';
$isAdmin    = strtolower($memberType) === 'admin';

// 1. Fetch the revision
$stmtRev = $mysqli->prepare("SELECT id, post_id, change_type, data_json FROM post_revisions WHERE id = ? LIMIT 1");
if (!$stmtRev) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Failed to prepare revision query']);
  exit;
}
$stmtRev->bind_param('i', $revisionId);
$stmtRev->execute();
$stmtRev->bind_result($revId, $postId, $changeType, $dataJson);
if (!$stmtRev->fetch()) {
  $stmtRev->close();
  http_response_code(404);
  echo json_encode(['success' => false, 'message' => 'Revision not found']);
  exit;
}
$stmtRev->close();

// 2. Verify ownership
$stmtOwner = $mysqli->prepare("SELECT member_id FROM posts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
if (!$stmtOwner) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Failed to verify post ownership']);
  exit;
}
$stmtOwner->bind_param('i', $postId);
$stmtOwner->execute();
$stmtOwner->bind_result($postOwnerId);
if (!$stmtOwner->fetch()) {
  $stmtOwner->close();
  http_response_code(404);
  echo json_encode(['success' => false, 'message' => 'Post not found']);
  exit;
}
$stmtOwner->close();

if (!$isAdmin && (int)$postOwnerId !== $memberId) {
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'You do not have permission to restore this post']);
  exit;
}

// 3. Decode the snapshot and verify it contains restorable data
$snapshot = json_decode($dataJson, true);
if (!is_array($snapshot) || !isset($snapshot['post_map_cards']) || !is_array($snapshot['post_map_cards'])) {
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'This revision is not in a restorable format.']);
  exit;
}

// Helper: get current columns for a table
function get_live_columns(mysqli $db, string $table): array {
  $cols = [];
  $result = $db->query("SHOW COLUMNS FROM `" . $db->real_escape_string($table) . "`");
  if ($result) {
    while ($row = $result->fetch_assoc()) {
      if (isset($row['Field'])) $cols[] = $row['Field'];
    }
    $result->free();
  }
  return $cols;
}

// Helper: resilient insert — only inserts columns that exist in the live table
// Returns array of skipped column names
function resilient_insert(mysqli $db, string $table, array $rows, array &$idMap = null): array {
  if (empty($rows)) return [];

  $liveCols = get_live_columns($db, $table);
  if (empty($liveCols)) return ['__table_missing__'];

  $skipped = [];
  $liveColSet = array_flip($liveCols);

  foreach ($rows as $row) {
    if (!is_array($row)) continue;

    // Filter to only columns that exist in the live table
    $insertCols = [];
    $insertVals = [];
    $oldId = isset($row['id']) ? (int)$row['id'] : null;

    foreach ($row as $col => $val) {
      // Skip auto-managed timestamps — let the DB handle them
      if ($col === 'created_at' || $col === 'updated_at') continue;

      if (!isset($liveColSet[$col])) {
        if (!in_array($col, $skipped, true)) $skipped[] = $col;
        continue;
      }
      $insertCols[] = "`" . $db->real_escape_string($col) . "`";
      $insertVals[] = ($val === null) ? "NULL" : "'" . $db->real_escape_string((string)$val) . "'";
    }

    if (empty($insertCols)) continue;

    $sql = "INSERT INTO `" . $db->real_escape_string($table) . "` (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $insertVals) . ")";
    $db->query($sql);

    // Track old ID → new ID mapping for post_map_cards
    if ($idMap !== null && $oldId !== null) {
      $idMap[$oldId] = $db->insert_id;
    }
  }

  return $skipped;
}

// 4. Begin transaction
if (!$mysqli->begin_transaction()) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Failed to start transaction']);
  exit;
}

$allSkipped = [];

try {
  // 4a. Delete current data for this post (children first)
  $currentMapCardIds = [];
  $mcResult = $mysqli->query("SELECT id FROM post_map_cards WHERE post_id = $postId");
  if ($mcResult) {
    while ($mcRow = $mcResult->fetch_assoc()) {
      $currentMapCardIds[] = (int)$mcRow['id'];
    }
    $mcResult->free();
  }

  if (!empty($currentMapCardIds)) {
    $mcIdList = implode(',', $currentMapCardIds);
    $mysqli->query("DELETE FROM post_ticket_pricing WHERE post_map_card_id IN ($mcIdList)");
    $mysqli->query("DELETE FROM post_item_pricing WHERE post_map_card_id IN ($mcIdList)");
    $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id IN ($mcIdList)");
    $mysqli->query("DELETE FROM post_amenities WHERE post_map_card_id IN ($mcIdList)");
  }
  $mysqli->query("DELETE FROM post_map_cards WHERE post_id = $postId");

  // 4b. Re-insert post_map_cards from the snapshot
  // We need to track old ID → new ID because child tables reference post_map_card_id
  $mapCardIdMap = []; // old_id => new_id
  $mapCardRows = $snapshot['post_map_cards'] ?? [];

  // For post_map_cards, we insert WITHOUT the id column so MySQL auto-generates new IDs,
  // but we track the mapping from old IDs to new IDs for child table foreign keys
  $mapCardsForInsert = [];
  foreach ($mapCardRows as $row) {
    $oldId = isset($row['id']) ? (int)$row['id'] : null;
    $rowWithoutId = $row;
    unset($rowWithoutId['id']);
    // Ensure post_id is correct
    $rowWithoutId['post_id'] = $postId;
    $mapCardsForInsert[] = ['old_id' => $oldId, 'row' => $rowWithoutId];
  }

  // Insert map cards one by one to track ID mapping
  $liveCols = get_live_columns($mysqli, 'post_map_cards');
  $liveColSet = array_flip($liveCols);
  foreach ($mapCardsForInsert as $entry) {
    $row = $entry['row'];
    $oldId = $entry['old_id'];
    $insertCols = [];
    $insertVals = [];

    foreach ($row as $col => $val) {
      if ($col === 'created_at' || $col === 'updated_at') continue;
      if (!isset($liveColSet[$col])) {
        $key = 'post_map_cards.' . $col;
        if (!in_array($key, $allSkipped, true)) $allSkipped[] = $key;
        continue;
      }
      $insertCols[] = "`" . $mysqli->real_escape_string($col) . "`";
      $insertVals[] = ($val === null) ? "NULL" : "'" . $mysqli->real_escape_string((string)$val) . "'";
    }

    if (!empty($insertCols)) {
      $sql = "INSERT INTO `post_map_cards` (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $insertVals) . ")";
      if ($mysqli->query($sql)) {
        if ($oldId !== null) {
          $mapCardIdMap[$oldId] = $mysqli->insert_id;
        }
      }
    }
  }

  // 4c. Re-insert child tables, remapping post_map_card_id to new IDs
  $childTables = ['post_sessions', 'post_ticket_pricing', 'post_item_pricing', 'post_amenities'];
  foreach ($childTables as $childTable) {
    $childRows = $snapshot[$childTable] ?? [];
    if (empty($childRows)) continue;

    $childLiveCols = get_live_columns($mysqli, $childTable);
    if (empty($childLiveCols)) {
      $allSkipped[] = $childTable . '.__table_missing__';
      continue;
    }
    $childLiveColSet = array_flip($childLiveCols);

    foreach ($childRows as $childRow) {
      if (!is_array($childRow)) continue;

      // Remap post_map_card_id
      $oldMcId = isset($childRow['post_map_card_id']) ? (int)$childRow['post_map_card_id'] : null;
      if ($oldMcId !== null && isset($mapCardIdMap[$oldMcId])) {
        $childRow['post_map_card_id'] = $mapCardIdMap[$oldMcId];
      }

      // Remove the auto-increment id so MySQL generates a new one
      unset($childRow['id']);

      $insertCols = [];
      $insertVals = [];
      foreach ($childRow as $col => $val) {
        if ($col === 'created_at' || $col === 'updated_at') continue;
        if (!isset($childLiveColSet[$col])) {
          $key = $childTable . '.' . $col;
          if (!in_array($key, $allSkipped, true)) $allSkipped[] = $key;
          continue;
        }
        $insertCols[] = "`" . $mysqli->real_escape_string($col) . "`";
        $insertVals[] = ($val === null) ? "NULL" : "'" . $mysqli->real_escape_string((string)$val) . "'";
      }

      if (!empty($insertCols)) {
        $sql = "INSERT INTO `" . $mysqli->real_escape_string($childTable) . "` (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $insertVals) . ")";
        $mysqli->query($sql);
      }
    }
  }

  // 4d. Update loc_qty on the posts table to match restored location count
  $restoredLocCount = count($mapCardRows);
  if ($restoredLocCount > 0) {
    $stmtLoc = $mysqli->prepare("UPDATE posts SET loc_qty = ?, loc_paid = GREATEST(loc_paid, ?), updated_at = NOW() WHERE id = ?");
    if ($stmtLoc) {
      $stmtLoc->bind_param('iii', $restoredLocCount, $restoredLocCount, $postId);
      $stmtLoc->execute();
      $stmtLoc->close();
    }
  }

  $mysqli->commit();

} catch (Exception $e) {
  $mysqli->rollback();
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Restore failed: ' . $e->getMessage()]);
  exit;
}

// 5. Build response
$response = [
  'success' => true,
  'message' => 'Post restored successfully',
  'post_id' => $postId,
  'revision_id' => $revisionId,
  'restored_map_cards' => count($mapCardRows),
  'restored_sessions' => count($snapshot['post_sessions'] ?? []),
  'restored_ticket_pricing' => count($snapshot['post_ticket_pricing'] ?? []),
  'restored_item_pricing' => count($snapshot['post_item_pricing'] ?? []),
  'restored_amenities' => count($snapshot['post_amenities'] ?? []),
];

if (!empty($allSkipped)) {
  $response['skipped_columns'] = $allSkipped;
  $response['message'] = 'Post restored with ' . count($allSkipped) . ' skipped column(s) that no longer exist in the database.';
}

echo json_encode($response, JSON_UNESCAPED_SLASHES);
exit;
?>
