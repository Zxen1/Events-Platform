<?php
/**
 * map-images-repair.php
 * Generates: (1) rename list for FileZilla, (2) SQL to fix map_images rows.
 *
 * Run from the website root via browser or CLI.
 * Reads live DB. Writes nothing — output only.
 */

// ── Bootstrap ────────────────────────────────────────────────────────────────

// Agent/ sits inside the website root; connectors sit at home/funmapco/connectors/
// Config discovery mirrors the pattern used by the connectors themselves.
$configCandidates = [
    __DIR__ . '/../home/funmapco/config/config-db.php',
    __DIR__ . '/../home/funmapco/connectors/../config/config-db.php',
    __DIR__ . '/../home/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/../config/config-db.php',
    __DIR__ . '/../config/config-db.php',
];
$mysqli = null;
foreach ($configCandidates as $path) {
    if (is_file($path)) {
        require_once $path;
        break;
    }
}
if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    // Debug: show which paths were tried
    $tried = implode("\n  ", $configCandidates);
    die("Could not connect to database.\nPaths tried:\n  $tried\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify_venue(string $text): string {
    $s = mb_strtolower($text, 'UTF-8');
    $s = preg_replace('/[^\p{L}\p{N}]+/u', '-', $s);
    $s = preg_replace('/-+/', '-', $s);
    $s = trim($s, '-');
    return mb_substr($s, 0, 50, 'UTF-8');
}

function format_coord(float $v): string {
    return rtrim(rtrim(sprintf('%.10f', $v), '0'), '.');
}

function best_name(array $row): string {
    $fields = ['venue_name', 'address_line', 'city', 'suburb', 'state', 'country_name'];
    foreach ($fields as $f) {
        $val = trim((string)($row[$f] ?? ''));
        if ($val !== '') return $val;
    }
    return '';
}

// ── Fetch broken map_images rows ──────────────────────────────────────────────

$brokenRows = [];
$res = $mysqli->query("SELECT id, latitude, longitude, bearing, file_url FROM map_images WHERE file_name = '' ORDER BY id ASC");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $brokenRows[] = $row;
    }
    $res->free();
}

if (empty($brokenRows)) {
    echo "No broken rows found (file_name = '' matched 0 rows).\n";
    exit;
}

// ── Build venue-name lookup by lat/lng ────────────────────────────────────────

$coordToInfo = [];
foreach ($brokenRows as $row) {
    $key = format_coord((float)$row['latitude']) . '_' . format_coord((float)$row['longitude']);
    if (isset($coordToInfo[$key])) continue;

    $stmt = $mysqli->prepare(
        "SELECT venue_name, address_line, city, suburb, state, country_name, location_type
         FROM post_map_cards WHERE latitude = ? AND longitude = ? LIMIT 1"
    );
    $lat = (float)$row['latitude'];
    $lng = (float)$row['longitude'];
    $stmt->bind_param('dd', $lat, $lng);
    $stmt->execute();
    $pmcRow = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $coordToInfo[$key] = $pmcRow ?: null;
}

// ── Build output ──────────────────────────────────────────────────────────────

$bearingDir = [0 => 'N', 90 => 'E', 180 => 'S', 270 => 'W'];
$renameLines  = [];   // OLD_FILENAME|NEW_FILENAME
$sqlLines     = [];   // UPDATE statements
$noName       = [];   // coord keys with no matching post_map_cards
$prefixCounts = [];   // prefix → count

foreach ($brokenRows as $row) {
    $id      = (int)$row['id'];
    $lat     = (float)$row['latitude'];
    $lng     = (float)$row['longitude'];
    $bearing = (int)$row['bearing'];
    $fileUrl = (string)$row['file_url'];

    $coordKey = format_coord($lat) . '_' . format_coord($lng);
    $pmcRow   = $coordToInfo[$coordKey] ?? null;

    // Extract old filename from URL
    $oldFilename = basename($fileUrl);

    // Count by prefix
    if (strpos($oldFilename, 'map_') === 0)        $prefixCounts['map_'] = ($prefixCounts['map_'] ?? 0) + 1;
    elseif (strpos($oldFilename, 'location__') === 0) $prefixCounts['location__'] = ($prefixCounts['location__'] ?? 0) + 1;
    elseif (strpos($oldFilename, '.') === 0)        $prefixCounts['.'] = ($prefixCounts['.'] ?? 0) + 1;
    else                                            $prefixCounts['other: ' . substr($oldFilename, 0, 20)] = ($prefixCounts['other: ' . substr($oldFilename, 0, 20)] ?? 0) + 1;

    if ($pmcRow === null) {
        $noName[] = "$coordKey (ID $id, bearing $bearing)";
        continue;
    }

    $rawName = best_name($pmcRow);
    if ($rawName === '') {
        $noName[] = "$coordKey (ID $id, bearing $bearing) — post_map_cards row exists but all name fields empty";
        continue;
    }

    $locType    = (isset($pmcRow['location_type']) && $pmcRow['location_type'] !== '') ? $pmcRow['location_type'] : 'venue';
    $slug       = slugify_venue($rawName);
    $dir        = $bearingDir[$bearing] ?? 'N';
    $repairZoom = (strtolower($locType) === 'city') ? 16 : 18;
    $newFilename = $slug . '__' . $coordKey . '__Z' . $repairZoom . '-P75-' . $dir . '.webp';
    $newUrl     = 'https://cdn.funmap.com/map-images/' . $newFilename;

    if ($oldFilename !== $newFilename) {
        $renameLines[] = $oldFilename . '|' . $newFilename;
    }

    $esc_fn  = $mysqli->real_escape_string($newFilename);
    $esc_url = $mysqli->real_escape_string($newUrl);
    $esc_lt  = $mysqli->real_escape_string($locType);
    $sqlLines[] = "UPDATE map_images SET file_name='$esc_fn', file_url='$esc_url', location_type='$esc_lt' WHERE id=$id;";
}

// ── Output ────────────────────────────────────────────────────────────────────

header('Content-Type: text/plain; charset=utf-8');

echo "=== MAP IMAGES REPAIR REPORT ===\n";
echo "Broken rows processed: " . count($brokenRows) . "\n";
echo "Renames needed:        " . count($renameLines) . "\n";
echo "SQL updates:           " . count($sqlLines) . "\n";
echo "No name found:         " . count($noName) . "\n";
echo "\n";
echo "=== PREFIX BREAKDOWN (all 428 rows) ===\n";
foreach ($prefixCounts as $prefix => $count) {
    echo str_pad("'$prefix'", 20) . " $count\n";
}
echo "\n";

if (!empty($noName)) {
    echo "=== NEEDS MANUAL REVIEW (no venue name found) ===\n";
    foreach ($noName as $line) echo $line . "\n";
    echo "\n";
}

echo "=== RENAME LIST (OLD_FILENAME|NEW_FILENAME) ===\n";
echo "Use this to rename files in FileZilla before re-uploading.\n";
echo "Files where old=new are already correctly named — skip them.\n\n";
foreach ($renameLines as $line) echo $line . "\n";

echo "\n\n=== SQL (run in database after FileZilla work is complete) ===\n\n";
foreach ($sqlLines as $line) echo $line . "\n";
