<?php
/**
 * Backfill city (and country_code) for post_map_cards using Google Geocoding API.
 *
 * Usage:  php Agent/backfill-city-data.php
 *
 * This script:
 *   1. Finds all post_map_cards where city IS NULL or empty, with valid lat/lng
 *   2. Groups by unique lat/lng to minimise API calls
 *   3. Calls Google reverse geocoding for each unique location
 *   4. Outputs SQL UPDATE statements for you to review and execute
 *
 * Delete this file after use.
 */

// ── Database connection (same pattern as connectors) ──────────────────────────

$configCandidates = [
    // Development (Agent/ is inside project root, config is at home/funmapco/config/)
    __DIR__ . '/../home/funmapco/config/config-db.php',
    dirname(__DIR__) . '/home/funmapco/config/config-db.php',
    // Production (Agent/ is inside docroot, config is one level above docroot)
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
    // Other common locations
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
    die("ERROR: Database configuration file not found.\n");
}

require_once $configPath;

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    die("ERROR: Database connection not available after loading config.\n");
}

// ── Google API key (same key used on the frontend) ────────────────────────────

$googleApiKey = 'AIzaSyATJV1D6MtAUsQ58fSEHcSD8QmznJXAPqY';

// ── Find post_map_cards with missing city ─────────────────────────────────────

$sql = "SELECT id, latitude, longitude, city, country_code
        FROM post_map_cards
        WHERE (city IS NULL OR city = '')
          AND latitude != 0
          AND longitude != 0
        ORDER BY id ASC";

$result = $mysqli->query($sql);
if (!$result) {
    die("ERROR: Query failed: " . $mysqli->error . "\n");
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$result->free();

if (empty($rows)) {
    echo "All post_map_cards already have city data. Nothing to do.\n";
    $mysqli->close();
    exit(0);
}

echo "Found " . count($rows) . " post_map_cards with missing city data.\n\n";

// ── Group by unique lat/lng to minimise API calls ─────────────────────────────

$uniqueLocations = [];
foreach ($rows as $row) {
    $key = $row['latitude'] . ',' . $row['longitude'];
    if (!isset($uniqueLocations[$key])) {
        $uniqueLocations[$key] = [
            'lat' => $row['latitude'],
            'lng' => $row['longitude'],
            'ids' => [],
            'ids_missing_country' => [],
        ];
    }
    $uniqueLocations[$key]['ids'][] = (int)$row['id'];
    if (empty($row['country_code'])) {
        $uniqueLocations[$key]['ids_missing_country'][] = (int)$row['id'];
    }
}

echo count($uniqueLocations) . " unique lat/lng pairs to geocode.\n";
echo str_repeat('-', 60) . "\n\n";

// ── Reverse geocode each unique location ──────────────────────────────────────

$sqlStatements = [];
$errors = [];

foreach ($uniqueLocations as $key => $loc) {
    $lat = $loc['lat'];
    $lng = $loc['lng'];

    // First try with result_type filter for better city extraction
    $url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng='
         . urlencode($lat) . ',' . urlencode($lng)
         . '&key=' . urlencode($googleApiKey)
         . '&result_type=locality|administrative_area_level_3|political';

    $response = @file_get_contents($url);
    if ($response === false) {
        $errors[] = "Network error fetching geocode for $lat,$lng";
        continue;
    }

    $data = json_decode($response, true);

    // Fallback: if filtered request returned no results, try unfiltered
    if (!$data || $data['status'] !== 'OK' || empty($data['results'])) {
        $url2 = 'https://maps.googleapis.com/maps/api/geocode/json?latlng='
              . urlencode($lat) . ',' . urlencode($lng)
              . '&key=' . urlencode($googleApiKey);

        $response2 = @file_get_contents($url2);
        $data = json_decode($response2, true);

        if (!$data || $data['status'] !== 'OK' || empty($data['results'])) {
            $errors[] = "No geocode results for $lat,$lng (status: " . ($data['status'] ?? 'unknown') . ")";
            continue;
        }
    }

    // Extract city and country from address_components
    $city = '';
    $countryCode = '';

    foreach ($data['results'] as $geoResult) {
        if (!isset($geoResult['address_components'])) {
            continue;
        }

        foreach ($geoResult['address_components'] as $comp) {
            $types = $comp['types'] ?? [];

            // City: prefer locality, fall back to admin level 3, then admin level 2
            if (empty($city) && in_array('locality', $types)) {
                $city = $comp['long_name'];
            }
            if (empty($city) && in_array('administrative_area_level_3', $types)) {
                $city = $comp['long_name'];
            }
            if (empty($city) && in_array('administrative_area_level_2', $types)) {
                $city = $comp['long_name'];
            }

            // Country code (short_name gives the 2-letter ISO code)
            if (empty($countryCode) && in_array('country', $types)) {
                $countryCode = strtoupper($comp['short_name']);
            }
        }

        // Stop once we have both
        if (!empty($city) && !empty($countryCode)) {
            break;
        }
    }

    if (empty($city)) {
        $errors[] = "Could not extract city for $lat,$lng";
        continue;
    }

    // Build SQL: city update
    $escapedCity = $mysqli->real_escape_string($city);
    $idList = implode(',', $loc['ids']);
    $sqlStatements[] = "UPDATE `post_map_cards` SET `city` = '$escapedCity' WHERE `id` IN ($idList);";

    // Build SQL: country_code update (only for rows that also lack it)
    if (!empty($countryCode) && !empty($loc['ids_missing_country'])) {
        $escapedCc = $mysqli->real_escape_string($countryCode);
        $ccIdList = implode(',', $loc['ids_missing_country']);
        $sqlStatements[] = "UPDATE `post_map_cards` SET `country_code` = '$escapedCc' WHERE `id` IN ($ccIdList);";
    }

    echo "  $lat, $lng  =>  city: $city"
       . (!empty($countryCode) ? ", country: $countryCode" : "")
       . "  (IDs: $idList)\n";

    // Polite rate limiting (200ms between requests)
    usleep(200000);
}

// ── Output ────────────────────────────────────────────────────────────────────

echo "\n" . str_repeat('-', 60) . "\n";

if (!empty($errors)) {
    echo "\nERRORS (" . count($errors) . "):\n";
    foreach ($errors as $err) {
        echo "  - $err\n";
    }
}

if (!empty($sqlStatements)) {
    echo "\n-- SQL to execute (" . count($sqlStatements) . " statements):\n\n";
    foreach ($sqlStatements as $stmt) {
        echo $stmt . "\n";
    }
} else {
    echo "\nNo SQL generated.\n";
}

$mysqli->close();
echo "\nDone.\n";
