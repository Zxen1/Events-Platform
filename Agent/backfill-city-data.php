<?php
/**
 * Backfill state for post_map_cards using Google Maps Geocoder.
 *
 * Usage: Visit this page in your browser at funmap.com/Agent/backfill-city-data.php
 *
 * This script:
 *   1. PHP queries the DB for post_map_cards with NULL/empty state
 *   2. Groups by unique lat/lng to minimise API calls
 *   3. Uses Google Maps JavaScript Geocoder (same API key as the site)
 *   4. Extracts state using the same logic as fieldsets.js (including UK exception)
 *   5. Displays SQL UPDATE statements for you to copy and execute
 *
 * Delete this file after use.
 */

// ── Database connection (same pattern as connectors) ──────────────────────────

$configCandidates = [
    __DIR__ . '/../home/funmapco/config/config-db.php',
    dirname(__DIR__) . '/home/funmapco/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    __DIR__ . '/../config/config-db.php',
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
    die("ERROR: Database configuration file not found.");
}

require_once $configPath;

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    die("ERROR: Database connection not available after loading config.");
}

// ── Query post_map_cards that need state ─────────────────────────────────────

$sql = "SELECT id, latitude, longitude, city, suburb, state, postcode
        FROM post_map_cards
        WHERE (state IS NULL OR state = '')
          AND latitude != 0
          AND longitude != 0
        ORDER BY id ASC";

$result = $mysqli->query($sql);
if (!$result) {
    die("ERROR: Query failed: " . $mysqli->error);
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$result->free();

// ── Group by unique lat/lng ───────────────────────────────────────────────────

$uniqueLocations = [];
foreach ($rows as $row) {
    $key = $row['latitude'] . ',' . $row['longitude'];
    if (!isset($uniqueLocations[$key])) {
        $uniqueLocations[$key] = [
            'lat' => (float)$row['latitude'],
            'lng' => (float)$row['longitude'],
            'city' => $row['city'] ?: '',
            'existingSuburb' => $row['suburb'] ?: '',
            'existingState' => $row['state'] ?: '',
            'existingPostcode' => $row['postcode'] ?: '',
            'ids' => [],
        ];
    }
    $uniqueLocations[$key]['ids'][] = (int)$row['id'];
}

$locationsJson = json_encode(array_values($uniqueLocations));
$totalRows = count($rows);
$totalUnique = count($uniqueLocations);

$mysqli->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backfill State Data (Google)</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 30px; line-height: 1.6; }
    h1 { color: #fff; margin-bottom: 10px; font-size: 18px; }
    h2 { color: #fff; margin-bottom: 8px; font-size: 15px; }
    .summary { color: #aaa; margin-bottom: 20px; }
    #log { background: #0f0f23; border: 1px solid #333; border-radius: 6px; padding: 16px; margin-bottom: 20px; max-height: 500px; overflow-y: auto; font-size: 13px; }
    .log-ok { color: #6bcf6b; }
    .log-err { color: #ff6b6b; }
    .log-info { color: #6bb3ff; }
    .log-warn { color: #f0c040; }
    #sql-output { background: #0f0f23; border: 1px solid #333; border-radius: 6px; padding: 16px; font-size: 13px; white-space: pre-wrap; word-break: break-all; max-height: 600px; overflow-y: auto; }
    .btn { display: inline-block; margin-top: 12px; padding: 8px 20px; background: #2a5298; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 13px; }
    .btn:hover { background: #3a6ab8; }
    #progress { color: #aaa; margin-bottom: 10px; }
</style>
</head>
<body>

<h1>Backfill State &mdash; Google Maps Geocoder</h1>

<?php if ($totalRows === 0): ?>
<p class="summary">All post_map_cards already have state data. Nothing to do.</p>
<?php else: ?>

<p class="summary">
    Found <strong><?= $totalRows ?></strong> post_map_cards needing state data.<br>
    <strong><?= $totalUnique ?></strong> unique lat/lng pairs to geocode via Google.<br>
    Estimated time: a few seconds.
</p>

<div id="progress">Loading Google Maps API...</div>
<div id="log"></div>

<h2>SQL to execute:</h2>
<div id="sql-output">Waiting for Google Maps API...</div>
<button class="btn" id="copy-btn" style="display:none;" onclick="copySQL()">Copy SQL to Clipboard</button>

<script>
var locations = <?= $locationsJson ?>;
var sqlStatements = [];
var errors = [];
var logEl = document.getElementById('log');
var sqlEl = document.getElementById('sql-output');
var progressEl = document.getElementById('progress');
var copyBtn = document.getElementById('copy-btn');
var geocoder = null;

function logLine(text, cls) {
    var div = document.createElement('div');
    div.className = cls || '';
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}

function escapeSQL(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Extraction functions (same logic as fieldsets.js) ─────────────────────────

function getComponent(results, type) {
    // Search through all results for a component with the given type
    for (var r = 0; r < results.length; r++) {
        var comps = results[r].address_components || [];
        for (var i = 0; i < comps.length; i++) {
            var c = comps[i];
            if (c && c.types && c.types.indexOf(type) !== -1) {
                return c;
            }
        }
    }
    return null;
}

function extractState(results) {
    // Same logic as fieldsets.js extractState — including UK exception.
    // administrative_area_level_1 = state/province/territory
    // For UK: level_1 returns "England"/"Scotland" — use level_2 (county) instead
    var level1Comp = getComponent(results, 'administrative_area_level_1');
    var level2Comp = getComponent(results, 'administrative_area_level_2');
    var level1 = level1Comp ? (level1Comp.long_name || level1Comp.short_name || '') : '';
    var level2 = level2Comp ? (level2Comp.long_name || level2Comp.short_name || '') : '';

    // UK constituent countries — use level_2 (county) instead
    if (level1 === 'England' || level1 === 'Scotland' || level1 === 'Wales' || level1 === 'Northern Ireland') {
        return level2 || level1;
    }
    return level1;
}

function extractSuburb(results, fallbackCity) {
    // sublocality_level_1 → sublocality → neighborhood → city fallback
    var sub1 = getComponent(results, 'sublocality_level_1');
    if (sub1) return (sub1.long_name || sub1.short_name || '').trim();
    var sub = getComponent(results, 'sublocality');
    if (sub) return (sub.long_name || sub.short_name || '').trim();
    var neigh = getComponent(results, 'neighborhood');
    if (neigh) return (neigh.long_name || neigh.short_name || '').trim();
    // Fall back to city (town scenario)
    var loc = getComponent(results, 'locality');
    if (loc) return (loc.long_name || loc.short_name || '').trim();
    return fallbackCity || '';
}

function extractPostcode(results) {
    var pc = getComponent(results, 'postal_code');
    return pc ? (pc.long_name || pc.short_name || '') : '';
}

// ── Geocoding loop ────────────────────────────────────────────────────────────

function geocodeNext(index) {
    if (index >= locations.length) {
        finish();
        return;
    }

    var loc = locations[index];
    progressEl.textContent = 'Geocoding ' + (index + 1) + ' of ' + locations.length + '...';

    var latlng = { lat: loc.lat, lng: loc.lng };

    doGeocode(loc, index, 0);
}

function finish() {
    progressEl.textContent = 'Done. ' + sqlStatements.length + ' SQL statements generated, ' + errors.length + ' errors.';

    if (sqlStatements.length > 0) {
        sqlEl.textContent = '-- ' + sqlStatements.length + ' statements:\n\n' + sqlStatements.join('\n');
        copyBtn.style.display = 'inline-block';
    } else {
        sqlEl.textContent = 'No SQL generated.';
    }

    if (errors.length > 0) {
        logLine('', '');
        logLine('ERRORS (' + errors.length + '):', 'log-err');
        for (var i = 0; i < errors.length; i++) {
            logLine('  - ' + errors[i], 'log-err');
        }
    }
}

function copySQL() {
    var text = sqlStatements.join('\n');
    navigator.clipboard.writeText(text).then(function() {
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.textContent = 'Copy SQL to Clipboard'; }, 2000);
    });
}

// ── Google Maps callback ──────────────────────────────────────────────────────

function initBackfill() {
    geocoder = new google.maps.Geocoder();
    progressEl.textContent = 'Google Maps API loaded. Starting...';

    if (locations.length === 0) {
        progressEl.textContent = 'Nothing to process.';
        sqlEl.textContent = 'No SQL generated.';
    } else {
        logLine('Starting state geocode for ' + locations.length + ' unique locations via Google...', 'log-info');
        logLine('', '');
        geocodeNext(0);
    }
}
</script>

<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyATJV1D6MtAUsQ58fSEHcSD8QmznJXAPqY&callback=initBackfill" async defer></script>

<?php endif; ?>

</body>
</html>
