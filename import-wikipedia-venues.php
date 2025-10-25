<?php
/**
 * import-wikipedia-venues.php (SSL-bypass edition)
 * -----------------------------------------------
 * Imports major venues from Wikidata → Wikipedia into FunMap DB.
 * Uses PDO from config-db (2).php, disables SSL verification for cURL.
 */

@set_time_limit(0);
@ini_set('memory_limit', '512M');
header('Content-Type: text/plain; charset=utf-8');

// --- Access guard ---
$allowed = php_sapi_name() === 'cli' || in_array($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', ['127.0.0.1','::1']);
if (!$allowed) { http_response_code(403); echo "Forbidden\n"; exit; }

// --- DB connection (from config-db (2).php) ---
$DB_HOST = 'localhost';
$DB_USER = 'funmapco_admin';
$DB_PASS = 'ZE4]G8wBFU6Lm03_P/,A';
$DB_NAME = 'funmapco_db';
try {
    $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER, $DB_PASS,
        [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
} catch(Exception $e){ http_response_code(500); echo "FATAL: DB connect failed\n"; exit; }

// --- constants ---
$subcategory_id=32;$subcategory_name='Venues';
$member_id=2;$member_name='Wikidata / Wikipedia (CC BY-SA 4.0)';
$assetDir='/home/funmapco/public_html/assets/venues';
$publicPrefix='/assets/venues';
if(!is_dir($assetDir))mkdir($assetDir,0755,true);
$maxImport=50;

// --- helpers ---
function slugify($s){$s=strtolower(trim($s));$s=preg_replace('/[^\w\s-]+/u','',$s);$s=preg_replace('/[\s_]+/','-',$s);return trim($s,'-')?:'venue';}
function curl_get($url,$t=10,$hdr=[]){
 if(function_exists('curl_version')){
  $c=curl_init($url);
  curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,
    CURLOPT_MAXREDIRS=>5,CURLOPT_TIMEOUT=>$t,CURLOPT_USERAGENT=>'FunMapImporter/1.0',
    CURLOPT_HTTPHEADER=>$hdr,CURLOPT_SSL_VERIFYPEER=>false,CURLOPT_SSL_VERIFYHOST=>0]);
  $d=curl_exec($c);$e=curl_error($c);$code=curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);
  if($d!==false&&$code<400)return $d;
 }
 $ctx=stream_context_create(['http'=>['method'=>'GET','header'=>implode("\r\n",$hdr),'timeout'=>$t],
  'ssl'=>['verify_peer'=>false,'verify_peer_name'=>false]]);
 $d=@file_get_contents($url,false,$ctx);
 return $d?:null;
}
function create_post($pdo,$sid,$sname,$mid,$mname,$title){
 $now=date('Y-m-d H:i:s');
 $q="INSERT INTO posts(subcategory_id,subcategory_name,member_id,member_name,title,created_at,updated_at,is_active,is_deleted)
     VALUES(?,?,?,?,?,?,?,1,0)";
 $pdo->prepare($q)->execute([$sid,$sname,$mid,$mname,$title,$now,$now]);
 return (int)$pdo->lastInsertId();
}
function create_field($pdo,$pid,$fid,$label,$val){
 $now=date('Y-m-d H:i:s');
 $pdo->prepare("INSERT INTO field_values(post_id,field_id,field_label,value,created_at,updated_at)
 VALUES(?,?,?,?,?,?)")->execute([$pid,$fid,$label,$val,$now,$now]);
}
function dup($pdo,$title){
 $s=$pdo->prepare("SELECT id FROM posts WHERE subcategory_id=32 AND title=? AND is_deleted=0 LIMIT 1");
 $s->execute([$title]);return(bool)$s->fetch();
}
function real_venue($x){if(!$x)return false;$l=strtolower($x);
 if(strpos($l,'may refer to')!==false||strpos($l,'list of')!==false)return false;
 if(strlen($x)<100)return false;return true;}
function get_extract($t){if(!$t)return'';$j=curl_get('https://en.wikipedia.org/api/rest_v1/page/summary/'.rawurlencode($t),10,['Accept: application/json']);
 if(!$j)return'';$d=json_decode($j,true);return $d['extract']??'';}
function dl_img($url,$label,$qid,$dir,$pub){
 if(!$url)return'';$slug=slugify($label);$file="$slug-$qid.jpg";
 $dst="$dir/$file";$rel="$pub/$file";if(file_exists($dst))return$rel;
 $tmp="$dst.tmp";$img=curl_get($url,15);if(!$img)return'';
 file_put_contents($tmp,$img);
 exec("convert ".escapeshellarg($tmp)." -resize 1600x1600\\> -auto-orient ".escapeshellarg($dst)." 2>&1",$o,$rc);
 @unlink($tmp);return($rc===0&&file_exists($dst))?$rel:'';
}

// --- SPARQL query ---
$q=<<<'Q'
SELECT ?item ?itemLabel ?coord ?coordLat ?coordLon ?image ?enwikiTitle WHERE {
  VALUES ?class { wd:Q522195 wd:Q13219666 wd:Q2085381 wd:Q10871550 wd:Q1774898 }
  ?item wdt:P31/wdt:P279* ?class .
  ?item wdt:P625 ?coord .
  BIND(geof:latitude(?coord) AS ?coordLat)
  BIND(geof:longitude(?coord) AS ?coordLon)
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?sitelink schema:about ?item ;schema:isPartOf <https://en.wikipedia.org/> ;schema:name ?enwikiTitle . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1000
Q;
$u='https://query.wikidata.org/sparql?format=json&query='.urlencode($q);
$j=curl_get($u,20,['Accept: application/sparql-results+json']);
if(!$j){echo"FATAL: Wikidata fetch failed\n";exit;}
$d=json_decode($j,true);if(empty($d['results']['bindings'])){echo"Empty\n";exit;}
$rows=$d['results']['bindings'];echo"Fetched ".count($rows)." venues\n";

$imp=0;$skip=0;
foreach($rows as$k=>$r){
 $lbl=$r['itemLabel']['value']??'';$lat=$r['coordLat']['value']??'';$lon=$r['coordLon']['value']??'';$img=$r['image']['value']??'';$wp=$r['enwikiTitle']['value']??'';
 $qid=preg_match('~/entity/(Q\d+)$~',$r['item']['value']??'', $m)?$m[1]:'';
 echo"[$k] $lbl\n";
 if($lat==''||$lon==''){echo" skip coords\n";$skip++;continue;}
 if(dup($pdo,$lbl)){echo" dup\n";$skip++;continue;}
 $desc=get_extract($wp);if(!real_venue($desc)){echo" bad desc\n";$skip++;continue;}
 $imgRel=$img?dl_img($img,$lbl,$qid,$assetDir,$publicPrefix):'';
 $pid=create_post($pdo,$subcategory_id,$subcategory_name,$member_id,$member_name,$lbl);
 create_field($pdo,$pid,1,'title',$lbl);
 create_field($pdo,$pid,2,'description',$desc);
 if($imgRel)create_field($pdo,$pid,3,'images',$imgRel);
 create_field($pdo,$pid,4,'venue_name',$lbl);
 create_field($pdo,$pid,5,'address_line',$lbl);
 create_field($pdo,$pid,6,'latitude',$lat);
 create_field($pdo,$pid,7,'longitude',$lon);
 echo" imported $lbl\n";$imp++;
 if($imp>=$maxImport){echo"limit reached\n";break;}
 sleep(2);
}
echo"\nImported $imp, skipped $skip\n";
echo"Move new images from /public_html/assets/venues/ to GitHub backups soon.\n";
?>
