<?php
/**
 * On-demand push relay, called by the app whenever it sends an in-app
 * notification. Deploy alongside push-lib.php and firebase-service-account.json
 * to the web root of https://www.h2.vbclimmattal.com.
 *
 * Keep PUSH_SECRET in sync with VITE_PUSH_SECRET in the app's .env file.
 */

require __DIR__ . '/push-lib.php';

define('PUSH_SECRET', '9rR5j98lWIjplGUrFVeu');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Push-Secret');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

$secret = $_SERVER['HTTP_X_PUSH_SECRET'] ?? '';
if (!hash_equals(PUSH_SECRET, $secret)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$body  = json_decode(file_get_contents('php://input'), true);
$token = $body['token'] ?? '';
$title = $body['title'] ?? '';
$text  = $body['body']  ?? '';
$link  = $body['link']  ?? '/';

if (!$token || !$title) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing token or title']);
    exit;
}

try {
    $accessToken = getAccessToken('https://www.googleapis.com/auth/firebase.messaging');
    [$status, $result] = sendFcmPush($accessToken, $token, $title, $text, $link);
    http_response_code($status === 200 ? 200 : 500);
    echo $result;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
