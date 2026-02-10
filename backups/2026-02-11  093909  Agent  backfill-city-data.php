<?php
/**
 * Backfill city (and country_code) for post_map_cards using OpenStreetMap Nominatim.
 *
 * Usage: Visit this page in your browser at funmap.com/Agent/backfill-city-data.php
 *
 * This script:
 *   1. PHP queries the DB for post_map_cards where city is NULL or empty
 *   2. Groups by unique lat/lng to minimise API calls
 *   3. Renders an HTML page that uses Nominatim (free, no API key needed)
 *   4. Displays SQL UPDATE statements for you to copy and execute
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

// ── Query post_map_cards with missing city ────────────────────────────────────

$sql = "SELECT id, latitude, longitude, city, country_code
        FROM post_map_cards
        WHERE (city IS NULL OR city = '')
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
            'ids' => [],
            'ids_missing_country' => [],
        ];
    }
    $uniqueLocations[$key]['ids'][] = (int)$row['id'];
    if (empty($row['country_code'])) {
        $uniqueLocations[$key]['ids_missing_country'][] = (int)$row['id'];
    }
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
<title>Backfill City Data</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 30px; line-height: 1.6; }
    h1 { color: #fff; margin-bottom: 10px; font-size: 18px; }
    h2 { color: #fff; margin-bottom: 8px; font-size: 15px; }
    .summary { color: #aaa; margin-bottom: 20px; }
    #log { background: #0f0f23; border: 1px solid #333; border-radius: 6px; padding: 16px; margin-bottom: 20px; max-height: 400px; overflow-y: auto; font-size: 13px; }
    .log-ok { color: #6bcf6b; }
    .log-err { color: #ff6b6b; }
    .log-info { color: #6bb3ff; }
    #sql-output { background: #0f0f23; border: 1px solid #333; border-radius: 6px; padding: 16px; font-size: 13px; white-space: pre-wrap; word-break: break-all; max-height: 600px; overflow-y: auto; }
    .btn { display: inline-block; margin-top: 12px; padding: 8px 20px; background: #2a5298; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-family: monospace; font-size: 13px; }
    .btn:hover { background: #3a6ab8; }
    #progress { color: #aaa; margin-bottom: 10px; }
</style>
</head>
<body>

<h1>Backfill City Data &mdash; post_map_cards</h1>

<?php if ($totalRows === 0): ?>
<p class="summary">All post_map_cards already have city data. Nothing to do.</p>
<?php else: ?>

<p class="summary">
    Found <strong><?= $totalRows ?></strong> post_map_cards with missing city data.<br>
    <strong><?= $totalUnique ?></strong> unique lat/lng pairs to geocode via OpenStreetMap Nominatim.
</p>

<div id="progress">Starting...</div>
<div id="log"></div>

<h2>SQL to execute:</h2>
<div id="sql-output">Processing...</div>
<button class="btn" id="copy-btn" style="display:none;" onclick="copySQL()">Copy SQL to Clipboard</button>

<script>
var locations = <?= $locationsJson ?>;
var sqlStatements = [];
var errors = [];
var logEl = document.getElementById('log');
var sqlEl = document.getElementById('sql-output');
var progressEl = document.getElementById('progress');
var copyBtn = document.getElementById('copy-btn');

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

function extractCity(address) {
    // Nominatim returns city under various keys depending on the location
    return address.city
        || address.town
        || address.village
        || address.municipality
        || address.county
        || '';
}

function geocodeNext(index) {
    if (index >= locations.length) {
        finish();
        return;
    }

    var loc = locations[index];
    progressEl.textContent = 'Geocoding ' + (index + 1) + ' of ' + locations.length + '...';

    var url = 'https://nominatim.openstreetmap.org/reverse?lat=' + loc.lat
            + '&lon=' + loc.lng
            + '&format=json&addressdetails=1&accept-language=en';

    fetch(url, {
        headers: { 'User-Agent': 'FunMapBackfillScript/1.0' }
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
        if (data && data.address) {
            var city = extractCity(data.address);
            var countryCode = (data.address.country_code || '').toUpperCase();

            if (city) {
                var idList = loc.ids.join(',');
                sqlStatements.push("UPDATE `post_map_cards` SET `city` = '" + escapeSQL(city) + "' WHERE `id` IN (" + idList + ");");

                if (countryCode && loc.ids_missing_country.length > 0) {
                    var ccIdList = loc.ids_missing_country.join(',');
                    sqlStatements.push("UPDATE `post_map_cards` SET `country_code` = '" + escapeSQL(countryCode) + "' WHERE `id` IN (" + ccIdList + ");");
                }

                logLine(loc.lat + ', ' + loc.lng + '  =>  city: ' + city + (countryCode ? ', country: ' + countryCode : '') + '  (IDs: ' + idList + ')', 'log-ok');
            } else {
                errors.push('Could not extract city for ' + loc.lat + ',' + loc.lng);
                logLine('Could not extract city for ' + loc.lat + ', ' + loc.lng + ' — raw: ' + JSON.stringify(data.address), 'log-err');
            }
        } else {
            var errMsg = data && data.error ? data.error : 'unknown error';
            errors.push('Nominatim error for ' + loc.lat + ',' + loc.lng + ': ' + errMsg);
            logLine('Nominatim error for ' + loc.lat + ', ' + loc.lng + ' — ' + errMsg, 'log-err');
        }

        // Nominatim requires max 1 request per second
        setTimeout(function() { geocodeNext(index + 1); }, 1100);
    })
    .catch(function(err) {
        errors.push('Network error for ' + loc.lat + ',' + loc.lng + ': ' + err.message);
        logLine('Network error for ' + loc.lat + ', ' + loc.lng + ' — ' + err.message, 'log-err');
        setTimeout(function() { geocodeNext(index + 1); }, 1100);
    });
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

// Start immediately
if (locations.length === 0) {
    progressEl.textContent = 'Nothing to process.';
    sqlEl.textContent = 'No SQL generated.';
} else {
    logLine('Starting geocode for ' + locations.length + ' unique locations via Nominatim...', 'log-info');
    logLine('(1 request per second to respect rate limits — will take ~' + locations.length + ' seconds)', 'log-info');
    geocodeNext(0);
}
</script>

<?php endif; ?>

</body>
</html>
