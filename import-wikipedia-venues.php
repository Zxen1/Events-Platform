<?php
/**
 * import-wikipedia-venues.php
 *
 * Bulk importer for major venues (stadiums, arenas, concert halls) from Wikidata -> Wikipedia.
 *
 * BEHAVIOUR:
 * - Connects via /home/funmapco/config/config-db.php
 * - Fetches ~1,000 venues (label, coords, Wikipedia link, image) using Wikidata's SPARQL endpoint
 *   for instances of arena / stadium / concert hall / indoor arena / amphitheatre.
 * - For each venue:
 *      - Gets first 2 paragraphs from Wikipedia lead
 *      - Builds listing in subcategory "Venues" (subcategory_id = 32)
 *      - Inserts a post under member_id = 2
 *        member_name = "Wikidata / Wikipedia (CC BY-SA 4.0)"
 *      - Populates all 7 fields including Venues fieldset fields:
 *          1 title
 *          2 description
 *          3 images (CSV of stored images)
 *          4 venue_name
 *          5 address_line
 *          6 latitude
 *          7 longitude
 * - Skips venue if:
 *      - missing coords
 *      - already exists in posts table with same title in subcategory 32
 *      - Wikipedia extract doesn't look like a real place
 *
 * - Downloads first image to /public_html/assets/venues/
 *   -> creates directory if missing
 *   -> saves as {slugified-venue-name}-{wikidata_id}.jpg
 *   -> DOES NOT OVERWRITE existing same filename
 *
 * SAFETY:
 * - Hard cap of $maxImport per run (default 50)
 * - Sleep(2) between inserts to avoid hammering DB or Wikipedia
 * - CLI-only / localhost only execution guard
 *
 * REQUIREMENTS:
 * - MySQL schema already has:
 *      posts(id, subcategory_id, member_id, member_name, title, created_at, updated_at, is_active, is_deleted)
 *      field_values(id, post_id, field_id, value, created_at, updated_at)
 *
 * - "Venues" subcategory already exists, with subcategory_id = 32
 *   and field_ids mapped as above
 *
 * - /public_html/assets/venues/ writable
 *
 * - cURL, PDO, ImageMagick `convert` available on server.
 */

// -----------------------------------------------------------------------------
// 1. Runtime + security guard
// -----------------------------------------------------------------------------
@set_time_limit(0);
@ini_set('memory_limit', '512M');
header('Content-Type: text/plain; charset=utf-8');

// Only allow CLI or local/private admin IPs.
// Adjust/disable this check if needed.
$allowed = php_sapi_name() === 'cli'
        || in_array($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', ['127.0.0.1','::1']);
if (!$allowed) {
    http_response_code(403);
    echo "Forbidden.\n";
    exit;
}

// -----------------------------------------------------------------------------
// 2. DB Connection (rebuilt for PDO using config-db (2).php credentials)
// -----------------------------------------------------------------------------

$DB_HOST = 'localhost';
$DB_USER = 'funmapco_admin';
$DB_PASS = 'ZE4]G8wBFU6Lm03_P/,A';
$DB_NAME = 'funmapco_db';

try {
    $dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo "FATAL: Database connection failed.\n";
    exit;
}

// -----------------------------------------------------------------------------
// 3. Constants / helpers
// -----------------------------------------------------------------------------

$subcategory_id   = 32;
$subcategory_name = 'Venues';

$member_id        = 2;
$member_name      = 'Wikidata / Wikipedia (CC BY-SA 4.0)';

$assetDir         = '/home/funmapco/public_html/assets/venues';
$publicPathPrefix = '/assets/venues';

if (!is_dir($assetDir)) {
    mkdir($assetDir, 0755, true);
}

// import cap for safety
$maxImport = 50;

// -----------------------------------------------------------------------------
// Helper: basic slug from name
// -----------------------------------------------------------------------------
function slugify_name($name) {
    $slug = strtolower(trim($name));
    $slug = preg_replace('/[^\w\s-]+/u', '', $slug);  // remove weird punctuation
    $slug = preg_replace('/[\s_]+/', '-', $slug);     // spaces -> dashes
    $slug = preg_replace('/-+/', '-', $slug);         // collapse --
    $slug = trim($slug, '-');
    if ($slug === '') {
        $slug = 'venue';
    }
    return $slug;
}

// -----------------------------------------------------------------------------
// Helper: fetch URL via curl and return body or null
// -----------------------------------------------------------------------------
function curl_get($url, $timeout = 10, $headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_USERAGENT      => 'FunMapImporter/1.0 (contact admin)',
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    $data = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($err || $code >= 400 || !$data) {
        return null;
    }
    return $data;
}

// -----------------------------------------------------------------------------
// Helper: create post row, return new post_id
// -----------------------------------------------------------------------------
function create_post($pdo, $subcategory_id, $subcategory_name, $member_id, $member_name, $title) {
    $now = date('Y-m-d H:i:s');

    $sql = "INSERT INTO posts
            (subcategory_id, subcategory_name, member_id, member_name, title,
             created_at, updated_at, is_active, is_deleted)
            VALUES
            (:subcategory_id, :subcategory_name, :member_id, :member_name, :title,
             :created_at, :updated_at, 1, 0)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':subcategory_id'   => $subcategory_id,
        ':subcategory_name' => $subcategory_name,
        ':member_id'        => $member_id,
        ':member_name'      => $member_name,
        ':title'            => $title,
        ':created_at'       => $now,
        ':updated_at'       => $now,
    ]);

    return (int)$pdo->lastInsertId();
}

// -----------------------------------------------------------------------------
// Helper: insert field_values row
// -----------------------------------------------------------------------------
function create_field_value($pdo, $post_id, $post_title, $field_id, $field_label, $value) {
    $now = date('Y-m-d H:i:s');

    $sql = "INSERT INTO field_values
            (post_id, field_id, field_label, value, created_at, updated_at)
            VALUES
            (:post_id, :field_id, :field_label, :value, :created_at, :updated_at)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':post_id'      => $post_id,
        ':field_id'     => $field_id,
        ':field_label'  => $field_label,
        ':value'        => $value,
        ':created_at'   => $now,
        ':updated_at'   => $now,
    ]);
}

// -----------------------------------------------------------------------------
// Helper: check for duplicate post title in this subcategory
// -----------------------------------------------------------------------------
function is_duplicate_title($pdo, $title) {
    $sql = "SELECT id
            FROM posts
            WHERE subcategory_id = 32
              AND title = :title
              AND is_deleted = 0
            LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':title' => $title]);
    $row = $stmt->fetch();
    return !!$row;
}

// -----------------------------------------------------------------------------
// Helper: very rough "is this extract describing a venue/place?"
// -----------------------------------------------------------------------------
function looks_like_real_venue($extractText) {
    if (!$extractText) return false;
    $lc = strtolower($extractText);

    // discard obvious disambiguation / stub-like junk
    if (strpos($lc, 'may refer to') !== false) return false;
    if (strpos($lc, 'list of') !== false) return false;

    // discard if it's clearly about a sports team, not stadium
    if (strpos($lc, 'is a professional') !== false &&
        (strpos($lc, 'football team') !== false || strpos($lc, 'basketball team') !== false)) {
        return false;
    }

    // require at least 100 chars of content
    if (strlen($extractText) < 100) return false;

    return true;
}

// -----------------------------------------------------------------------------
// Helper: download first image and convert to jpg
// returns relative path (/assets/venues/filename.jpg) or '' if fail
// -----------------------------------------------------------------------------
function download_first_image($imageUrl, $venueLabel, $wikidataId, $assetDir, $publicPathPrefix) {
    if (!$imageUrl) return '';

    $slug     = slugify_name($venueLabel);
    $basename = $slug . '-' . $wikidataId . '.jpg';
    $destAbs  = rtrim($assetDir, '/') . '/' . $basename;
    $destRel  = rtrim($publicPathPrefix, '/') . '/' . $basename;

    if (file_exists($destAbs)) {
        return $destRel;
    }

    $tmpFile = $destAbs . '.tmpdl';
    $imgData = curl_get($imageUrl, 15);
    if (!$imgData) {
        echo "   [img] failed download $imageUrl\n";
        return '';
    }
    file_put_contents($tmpFile, $imgData);

    // use ImageMagick convert to ensure it's jpg and reasonable size
    // we'll just resize width down to max 1600px (keeping aspect)
    $cmd = sprintf(
        'convert %s -resize 1600x1600\> -auto-orient %s 2>&1',
        escapeshellarg($tmpFile),
        escapeshellarg($destAbs)
    );
    exec($cmd, $outLines, $rc);
    unlink($tmpFile);

    if ($rc !== 0 || !file_exists($destAbs)) {
        echo "   [img] convert failed rc=$rc\n";
        return '';
    }

    return $destRel;
}

// -----------------------------------------------------------------------------
// Helper: fetch best summary paragraphs from Wikipedia
// -----------------------------------------------------------------------------
function get_wikipedia_extract($pageTitle) {
    if (!$pageTitle) return '';

    // use REST API summary
    $url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' . rawurlencode($pageTitle);
    $json = curl_get($url, 10, ['Accept: application/json']);
    if (!$json) return '';

    $data = json_decode($json, true);
    if (!is_array($data) || empty($data['extract'])) {
        return '';
    }

    $extract = trim($data['extract']);

    // We might want only first 2 paragraphs:
    // split by double newline as a crude paragraph split
    $paras = preg_split("/\n\s*\n/", $extract);
    $paras = array_slice($paras, 0, 2);

    $short = implode("\n\n", array_map('trim', $paras));
    return $short;
}

// -----------------------------------------------------------------------------
// Helper: build address_line from coordinate and label? (stub placeholder)
// In practice we'd reverse geocode or parse Wikidata address claims,
// but for MVP we store just the label for now.
// -----------------------------------------------------------------------------
function build_address_line($label) {
    return $label;
}

// -----------------------------------------------------------------------------
// 4. Fetch candidate venues from Wikidata SPARQL
// -----------------------------------------------------------------------------

// Instances of arenas, stadiums, concert halls...
// We'll query some well-known venue classes (Q ids are Wikidata entity IDs):
// Q522195 = stadium
// Q13219666 = arena
// Q2085381 = concert hall
// Q10871550 = indoor arena
// Q1774898 = amphitheatre
$query = <<<SPARQL
SELECT ?item ?itemLabel ?coord ?coordLat ?coordLon ?image ?enwikiTitle WHERE {
  VALUES ?class { wd:Q522195 wd:Q13219666 wd:Q2085381 wd:Q10871550 wd:Q1774898 }
  ?item wdt:P31/wdt:P279* ?class .
  ?item wdt:P625 ?coord .
  BIND(geof:latitude(?coord)  AS ?coordLat)
  BIND(geof:longitude(?coord) AS ?coordLon)

  OPTIONAL { ?item wdt:P18 ?image . }

  OPTIONAL {
    ?sitelink schema:about ?item ;
              schema:isPartOf <https://en.wikipedia.org/> ;
              schema:name ?enwikiTitle .
  }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1000
SPARQL;

$wikidataUrl = 'https://query.wikidata.org/sparql?format=json&query=' . urlencode($query);
$wikidataJson = curl_get($wikidataUrl, 20, ['Accept: application/sparql-results+json']);
if (!$wikidataJson) {
    echo "FATAL: Wikidata SPARQL fetch failed.\n";
    exit;
}

$wikidata = json_decode($wikidataJson, true);
if (!is_array($wikidata) || empty($wikidata['results']['bindings'])) {
    echo "FATAL: Wikidata response bad/empty.\n";
    exit;
}

$rows = $wikidata['results']['bindings'];
echo "Fetched " . count($rows) . " candidate venues.\n\n";

// -----------------------------------------------------------------------------
// 5. Iterate, enrich with Wikipedia, insert
// -----------------------------------------------------------------------------
$importCount = 0;
$skipCount   = 0;

foreach ($rows as $idx => $r) {
    $label = $r['itemLabel']['value'] ?? '';
    $lat   = $r['coordLat']['value'] ?? '';
    $lon   = $r['coordLon']['value'] ?? '';
    $img   = $r['image']['value'] ?? '';
    $wp    = $r['enwikiTitle']['value'] ?? '';

    // Q-ID from URI
    $qid = '';
    if (!empty($r['item']['value'])) {
        // e.g. "http://www.wikidata.org/entity/Q12345"
        if (preg_match('~/entity/(Q\d+)$~', $r['item']['value'], $m)) {
            $qid = $m[1];
        }
    }

    echo "[$idx] $label (Q:$qid)\n";

    // must have coords
    if ($lat === '' || $lon === '') {
        echo "   skip: missing coords\n";
        $skipCount++;
        continue;
    }

    // duplicate?
    if (is_duplicate_title($pdo, $label)) {
        echo "   skip: already exists in posts\n";
        $skipCount++;
        continue;
    }

    // fetch summary
    $summary = get_wikipedia_extract($wp);
    if (!looks_like_real_venue($summary)) {
        echo "   skip: summary looks wrong/too short/not a venue\n";
        $skipCount++;
        continue;
    }

    // build address_line
    $addressLine = build_address_line($label);

    // try image
    $imagesCsv = '';
    if ($img) {
        $rel = download_first_image($img, $label, $qid, $assetDir, $publicPathPrefix);
        if ($rel) {
            $imagesCsv = $rel;
            echo "   image saved: $rel\n";
        } else {
            echo "   no image saved\n";
        }
    } else {
        echo "   no wikidata image\n";
    }

    // create post
    $post_id = create_post(
        $pdo,
        $subcategory_id,
        $subcategory_name,
        $member_id,
        $member_name,
        $label
    );

    // create field values
    // 1. title
    // 2. description
    // 3. images
    // 4. venue_name
    // 5. address_line
    // 6. latitude
    // 7. longitude
    $descForSite = $summary;

    create_field_value($pdo, $post_id, $label, 1, 'title', $label);
    create_field_value($pdo, $post_id, $label, 2, 'description', $descForSite);

    if ($imagesCsv !== '') {
        create_field_value($pdo, $post_id, $label, 3, 'images', $imagesCsv);
    }

    create_field_value($pdo, $post_id, $label, 4, 'venue_name', $label);
    create_field_value($pdo, $post_id, $label, 5, 'address_line', $addressLine);

    if ($lat !== '') {
        create_field_value($pdo, $post_id, $label, 6, 'latitude', $lat);
    }
    if ($lon !== '') {
        create_field_value($pdo, $post_id, $label, 7, 'longitude', $lon);
    }

    $importCount++;
    echo "[$idx] OK imported post_id=$post_id \"$label\" (total=$importCount)\n";

    if ($importCount >= $maxImport) {
        echo "Reached import cap ($maxImport).\n";
        break;
    }

    sleep(2);
}

echo "\nDone.\nImported: $importCount\nSkipped: $skipCount\n";
echo "⚠️ Move all new images from /public_html/assets/venues/ to GitHub immediately or they’ll be deleted on next sync.\n";
?>
