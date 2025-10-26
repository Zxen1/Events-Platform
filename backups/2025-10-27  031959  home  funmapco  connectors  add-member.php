<?php
// connectors/add-member.php — safe version
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);
require_once __DIR__ . '/../config/config-db.php';

function fail($code, $msg){http_response_code($code);echo json_encode(['success'=>false,'error'=>$msg]);exit;}
function ok($data=[]){echo json_encode(array_merge(['success'=>true],$data));exit;}

if($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'Method not allowed');

$display = trim($_POST['display_name'] ?? '');
$email = trim($_POST['email'] ?? '');
$pass = $_POST['password'] ?? '';
$conf = $_POST['confirm'] ?? '';
$avatar = trim($_POST['avatar_url'] ?? '');

if($display===''||$email===''||$pass==='') fail(400,'Missing required fields');
if(!filter_var($email,FILTER_VALIDATE_EMAIL)) fail(400,'Invalid email address');
if($pass!==$conf) fail(400,'Passwords do not match');

$hash = password_hash($pass, PASSWORD_BCRYPT);
if(!$hash) fail(500,'Hash failed');

$stmt = $mysqli->prepare('SELECT id FROM members WHERE email=? LIMIT 1');
if(!$stmt) fail(500,'Prepare failed (check query)');
$stmt->bind_param('s',$email);
$stmt->execute();
$stmt->store_result();
if($stmt->num_rows>0){$stmt->close();fail(409,'Email already registered');}
$stmt->close();

$insert = $mysqli->prepare('INSERT INTO members (email,password_hash,display_name,avatar_url,created_at) VALUES (?,?,?,?,NOW())');
if(!$insert) fail(500,'Insert prepare failed');
$insert->bind_param('ssss',$email,$hash,$display,$avatar);
if(!$insert->execute()){ $insert->close(); fail(500,'Database insert failed'); }
$id = $insert->insert_id;
$insert->close();

ok(['id'=>$id,'display_name'=>$display,'email'=>$email]);
?>