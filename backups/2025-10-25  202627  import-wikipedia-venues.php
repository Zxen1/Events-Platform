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
 *          title                (fields.id = 1)
 *          description          (fields.id = 2)
 *          images               (fields.id = 3)
 *          venue_name           (fields.id = 4)
 *          address_line         (fields.id = 5)
 *          latitude             (fields.id = 6)
 *          longitude            (fields.id = 7)
 *        Note: Sessions / Ticket Pricing are NOT populated for static venues.
 *      - Saves thumbnail images into /public_html/assets/venues/ as 80x80 and 40x40 PNG
 *        using ImageMagick (convert). File names are slugged to avoid collisions.
 *      - Avoids duplicates (case-insensitive title match in posts.title).
 *      - Sleeps 2 seconds between venue imports to avoid rate limiting.
 *      - Echoes progress counter.
 *
 * FINAL OUTPUT WHEN RUN:
 * - Prints running status and summary.
 * - Ends with:
 *   "⚠️ Move all new images from /public_html/assets/venues/ to GitHub immediately or they’ll be deleted on next sync."
 *
 * REQUIREMENTS:
 * - PHP 8.2.29 compatible.
 * - cURL, PDO, ImageMagick `convert` available on server.
 * - This script should be run from CLI (php import-wikipedia-venues.php) or via browser by admin only.
 *
 * DATA MODEL CONTEXT:
 * Tables come from funmapco_db (9).sql which defines:
 *   posts(id, subcategory_id, member_id, title, ...)
 *   field_values(post_id, field_id, value, ...)
 *   members(id=2 name='Wikidata / Wikipedia (CC BY-SA 4.0)')
 *   subcategories(id=32, name='Venues', listing_type='standard', fieldset_ids='1')
 *   fieldsets( id=1 'Venues' -> field_ids 4,5,6,7 )
 *   fields:
 *     1=title
 *     2=description
 *     3=images
 *     4=venue_name
 *     5=address_line
 *     6=latitude
 *     7=longitude
 */

// -----------------------------------------------------------------------------
// 1. Security / Runtime mode
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
// 2. DB Connection via existing site config
// -----------------------------------------------------------------------------
$CONFIG_PATH = '/home/funmapco/config/config-db.php';
if (!file_exists($CONFIG_PATH)) {
    echo "FATAL: config-db.php not found at $CONFIG_PATH\n";
    exit;
}

// Expect config-db.php to either define $pdo OR constants to build PDO.
require_once $CONFIG_PATH;

function getDbHandle() {
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        return $GLOBALS['pdo'];
    }

    // Fallback: assume constants DB_HOST, DB_NAME, DB_USER, DB_PASS exist.
    if (
        defined('DB_HOST') &&
        defined('DB_NAME') &&
        defined('DB_USER') &&
        defined('DB_PASS')
    ) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    }

    echo "FATAL: No PDO and no DB_* constants.\n";
    exit;
}

$pdo = getDbHandle();

// -----------------------------------------------------------------------------
// 3. Constants / helpers
// -----------------------------------------------------------------------------
$SUBCATEGORY_ID   = 32;
$SUBCATEGORY_NAME = "Venues";
$MEMBER_ID        = 2;
$MEMBER_NAME      = "Wikidata / Wikipedia (CC BY-SA 4.0)";
$ASSET_DIR        = '/public_html/assets/venues'; // absolute path on server
$ASSET_URL_PREFIX = 'assets/venues';              // how site will reference it

// Create output dir if missing
if (!is_dir($ASSET_DIR)) {
    if (!mkdir($ASSET_DIR, 0755, true) && !is_dir($ASSET_DIR)) {
        echo "FATAL: Cannot create $ASSET_DIR\n";
        exit;
    }
}

// Slugify for filenames
function slugify($text) {
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/i', '-', $text);
    $text = trim($text, '-');
    if ($text === '') $text = 'venue';
    return $text;
}

// Safe shell escape for exec()
function sh($s) {
    return escapeshellarg($s);
}

// Fetch URL helper
function http_get_json($url, $headers = []) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_USERAGENT      => 'FunMapVenueImporter/1.0 (CC BY-SA 4.0 attribution)'
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($err || $code < 200 || $code >= 300) {
        return null;
    }

    $data = json_decode($body, true);
    if (!is_array($data)) return null;
    return $data;
}

function http_get_raw($url, $headers = []) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_USERAGENT      => 'FunMapVenueImporter/1.0 (CC BY-SA 4.0 attribution)'
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($err || $code < 200 || $code >= 300) {
        return null;
    }
    return $body;
}

// Extract first two paragraphs from Wikipedia lead HTML
function extract_first_two_paragraphs($html) {
    $paras = [];
    if (preg_match_all('#<p\b[^>]*>(.*?)</p>#is', $html, $m)) {
        foreach ($m[1] as $phtml) {
            $clean = $phtml;
            $clean = preg_replace('/<sup[^>]*>.*?<\/sup>/is', '', $clean);
            $clean = strip_tags($clean);
            $clean = trim($clean);
            if ($clean !== '') {
                $paras[] = $clean;
            }
            if (count($paras) >= 2) break;
        }
    }
    $text = implode("\n\n", $paras);
    return $text;
}

// Insert post row
function create_post($pdo, $subcategory_id, $subcategory_name, $member_id, $member_name, $title) {
    $sql = "INSERT INTO posts
        (subcategory_id, subcategory_name, member_id, member_name, title, status, moderation_status, created_at, updated_at)
        VALUES (:sid, :sname, :mid, :mname, :title, 'active', 'clean', NOW(), NOW())";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':sid'   => $subcategory_id,
        ':sname' => $subcategory_name,
        ':mid'   => $member_id,
        ':mname' => $member_name,
        ':title' => $title,
    ]);
    return (int)$pdo->lastInsertId();
}

// Insert a field_value row
function create_field_value($pdo, $post_id, $post_title, $field_id, $field_label, $value) {
    $sql = "INSERT INTO field_values
        (post_id, post_title, field_id, field_label, value)
        VALUES (:pid, :ptitle, :fid, :flabel, :val)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':pid'    => $post_id,
        ':ptitle' => $post_title,
        ':fid'    => $field_id,
        ':flabel' => $field_label,
        ':val'    => $value,
    ]);
}

// Check duplicate by title (case-insensitive)
function is_duplicate_title($pdo, $title) {
    $sql = "SELECT id FROM posts WHERE LOWER(title)=LOWER(:t) LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':t' => $title]);
    return $stmt->fetchColumn() ? true : false;
}

// Download main image, create thumbnails 80x80 and 40x40, return comma-separated file paths
function handle_image_thumbs($imageUrl, $venueTitle, $ASSET_DIR, $ASSET_URL_PREFIX) {
    if (!$imageUrl) {
        return '';
    }

    $raw = http_get_raw($imageUrl);
    if (!$raw) {
        return '';
    }

    $slug = slugify($venueTitle);
    $uniq = substr(sha1($venueTitle . microtime(true)), 0, 8);
    $base = $slug . '-' . $uniq;
    $origPath = rtrim($ASSET_DIR,'/')."/".$base."-orig.png";
    file_put_contents($origPath, $raw);

    $sizes = [
        '80x80' => $base . '-80.png',
        '40x40' => $base . '-40.png',
    ];
    foreach ($sizes as $dim => $fname) {
        $outPath = rtrim($ASSET_DIR,'/')."/".$fname;
        $cmd = "convert " . escapeshellarg($origPath) .
               " -resize " . escapeshellarg($dim."^") .
               " -gravity center -extent " . escapeshellarg($dim) .
               " " . escapeshellarg($outPath);
        @exec($cmd, $o, $ret);
        if ($ret !== 0) {
            $cmd2 = "convert " . escapeshellarg($origPath) .
                    " -resize " . escapeshellarg($dim) .
                    " " . escapeshellarg($outPath);
            @exec($cmd2);
        }
    }

    $img80 = $ASSET_URL_PREFIX . '/' . $sizes['80x80'];
    $img40 = $ASSET_URL_PREFIX . '/' . $sizes['40x40'];

    return $img80 . ',' . $img40;
}

// -----------------------------------------------------------------------------
// 4. Build Wikidata query list of venues
// -----------------------------------------------------------------------------
$sparql = urlencode("
SELECT DISTINCT ?item ?itemLabel ?coord ?image ?enwiki
WHERE {
  VALUES ?class {
    wd:Q483110
    wd:Q173242
    wd:Q41253
    wd:Q157570
    wd:Q16970
  }
  ?item wdt:P31/wdt:P279* ?class .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?enwikiArticle schema:about ?item ;
                   schema:isPartOf <https://en.wikipedia.org/> ;
                   schema:name ?enwiki .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". }
}
LIMIT 1200
");

$sparqlUrl = "https://query.wikidata.org/sparql?format=json&query=" . $sparql;
$results = http_get_json($sparqlUrl, [
    "Accept: application/sparql-results+json"
]);

if (!$results || !isset($results['results']['bindings'])) {
    echo "FATAL: SPARQL fetch failed.\n";
    exit;
}

$bindings = $results['results']['bindings'];
$totalCandidates = count($bindings);
echo "Fetched $totalCandidates candidate venues from Wikidata.\n";

// -----------------------------------------------------------------------------
// 5. Import loop
// -----------------------------------------------------------------------------
$importCount = 0;
$skipCount   = 0;
$maxImport   = 1000;
$idx         = 0;

foreach ($bindings as $row) {
    $idx++;

    $label = $row['itemLabel']['value'] ?? null;
    $wikiTitle = $row['enwiki']['value'] ?? null;
    $coord = $row['coord']['value'] ?? null;
    $image = $row['image']['value'] ?? null;

    if (!$label || !$coord || !$wikiTitle) {
        $skipCount++;
        echo "[$idx] SKIP missing data\n";
        continue;
    }

    if (is_duplicate_title($pdo, $label)) {
        $skipCount++;
        echo "[$idx] SKIP duplicate: $label\n";
        continue;
    }

    $lat = null;
    $lon = null;
    if (preg_match('/Point\(([-0-9\.]+)\s+([-0-9\.]+)\)/', $coord, $m)) {
        $lon = $m[1];
        $lat = $m[2];
    }

    $wikiApiUrl = "https://en.wikipedia.org/api/rest_v1/page/mobile-sections-lead/" . rawurlencode($wikiTitle);
    $wikiJson   = http_get_json($wikiApiUrl);
    $leadHtml   = $wikiJson['lead']['sections'][0]['text'] ?? '';
    $extract2   = extract_first_two_paragraphs($leadHtml);

    $moreUrl = "https://en.wikipedia.org/wiki/" . rawurlencode($wikiTitle);
    $descForSite = $extract2;
    if ($descForSite !== '') {
        $descForSite .= \"\n\n... Read more → \" . $moreUrl;
    } else {
        $descForSite = \"Read more → \" . $moreUrl;
    }

    $addressLine = $label;

    $imagesCsv = '';
    if ($image) {
        $commonsUrl = \"https://commons.wikimedia.org/wiki/Special:FilePath/\" . rawurlencode(basename($image));
        $imagesCsv = handle_image_thumbs($commonsUrl, $label, $ASSET_DIR, $ASSET_URL_PREFIX);
    }

    $post_id = create_post(
        $pdo,
        $SUBCATEGORY_ID,
        $SUBCATEGORY_NAME,
        $MEMBER_ID,
        $MEMBER_NAME,
        $label
    );

    create_field_value($pdo, $post_id, $label, 1, 'title', $label);
    create_field_value($pdo, $post_id, $label, 2, 'description', $descForSite);

    if ($imagesCsv !== '') {
        create_field_value($pdo, $post_id, $label, 3, 'images', $imagesCsv);
    }

    create_field_value($pdo, $post_id, $label, 4, 'venue_name', $label);
    create_field_value($pdo, $post_id, $label, 5, 'address_line', $addressLine);

    if ($lat !== null) {
        create_field_value($pdo, $post_id, $label, 6, 'latitude', $lat);
    }
    if ($lon !== null) {
        create_field_value($pdo, $post_id, $label, 7, 'longitude', $lon);
    }

    $importCount++;
    echo \"[$idx] OK imported post_id=$post_id \\\"$label\\\" (total=$importCount)\\n\";

    if ($importCount >= $maxImport) {
        echo \"Reached import cap ($maxImport).\\n\";
        break;
    }

    sleep(2);
}

echo \"\\nDone.\\nImported: $importCount\\nSkipped: $skipCount\\n\";
echo \"⚠️ Move all new images from /public_html/assets/venues/ to GitHub immediately or they’ll be deleted on next sync.\\n\";
?>