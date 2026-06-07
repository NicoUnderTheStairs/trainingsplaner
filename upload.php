<?php
/**
 * Upload handler for player ID files.
 * Deploy this file to the web root of https://www.h2.vbclimmattal.com
 * Files are stored at:  teams/{teamId}/{playerName}.{ext}
 * Public URL pattern:   https://www.h2.vbclimmattal.com/teams/{teamId}/{playerName}.{ext}
 */

// ── CORS ───────────────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: X-Upload-Token, Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
define('UPLOAD_SECRET', 'hwG[v[8QVqmrHC)');

$token = $_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '';
if ($token !== UPLOAD_SECRET) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// ── Method ─────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Inputs ─────────────────────────────────────────────────────────────────────
$teamId     = trim($_POST['teamId']     ?? '');
$playerName = trim($_POST['playerName'] ?? '');

if (!$teamId || !$playerName) {
    http_response_code(400);
    echo json_encode(['error' => 'teamId and playerName are required']);
    exit;
}

// Sanitize: only alphanumeric, dash, underscore (match what the frontend sends)
$teamId     = preg_replace('/[^a-zA-Z0-9_-]/',  '',  $teamId);
$playerName = preg_replace('/[^a-zA-Z0-9 _-]/', '',  $playerName);
$playerName = str_replace(' ', '_', $playerName);

if (!$teamId || !$playerName) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid teamId or playerName after sanitization']);
    exit;
}

// ── File validation ────────────────────────────────────────────────────────────
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form limit',
        UPLOAD_ERR_NO_FILE    => 'No file received',
    ];
    $code = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    http_response_code(400);
    echo json_encode(['error' => $uploadErrors[$code] ?? 'Upload error']);
    exit;
}

// Max 8 MB
if ($_FILES['file']['size'] > 8 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large (max 8 MB)']);
    exit;
}

$ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
$allowedExts  = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'pdf'];
$allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif', 'application/pdf',
];

if (!in_array($ext, $allowedExts, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'File type not allowed (jpg, png, gif, webp, heic, pdf)']);
    exit;
}

// Verify MIME type from actual file content, not just the name
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $_FILES['file']['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'File content does not match allowed types']);
    exit;
}

// ── Save ───────────────────────────────────────────────────────────────────────
$dir = __DIR__ . '/teams/' . $teamId;

if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not create directory']);
    exit;
}

$filename = $playerName . '.' . $ext;
$filepath = $dir . '/' . $filename;

if (!move_uploaded_file($_FILES['file']['tmp_name'], $filepath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not save file']);
    exit;
}

// ── Respond ────────────────────────────────────────────────────────────────────
$url = 'https://www.h2.vbclimmattal.com/teams/' . $teamId . '/' . rawurlencode($filename);
echo json_encode(['url' => $url]);
