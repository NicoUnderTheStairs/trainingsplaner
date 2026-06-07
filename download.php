<?php
/**
 * Secure download handler for player/coach ID files.
 * Deploy this file to the web root of https://www.h2.vbclimmattal.com,
 * alongside config.php and upload.php.
 *
 * Files live at teams/{teamId}/{name}.{ext}. That directory is blocked from
 * direct browser access via teams/.htaccess, so this script is the only way
 * to read them — and only with a valid access token.
 *
 * Usage:  GET /download.php?path=teams/{teamId}/{name}.{ext}
 * Header: X-Download-Token: <shared secret>
 */

require __DIR__ . '/config.php';

// ── CORS ───────────────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: X-Download-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function fail(int $code, string $error): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $error]);
    exit;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
$token = $_SERVER['HTTP_X_DOWNLOAD_TOKEN'] ?? '';
if (!hash_equals(ACCESS_SECRET, $token)) {
    fail(401, 'Unauthorized');
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail(405, 'Method not allowed');
}

// ── Resolve & validate path ────────────────────────────────────────────────────
// Only "teams/{teamId}/{filename}" is allowed — this also blocks traversal
// (no "..", no leading slash, no other directories).
$relPath = ltrim((string) ($_GET['path'] ?? ''), '/');

if (!preg_match('#^teams/[a-zA-Z0-9_-]+/[a-zA-Z0-9 ._-]+$#', $relPath)) {
    fail(400, 'Invalid path');
}

$baseDir  = realpath(__DIR__ . '/teams');
$fullPath = realpath(__DIR__ . '/' . $relPath);

if (
    $baseDir === false ||
    $fullPath === false ||
    strpos($fullPath, $baseDir . DIRECTORY_SEPARATOR) !== 0 ||
    !is_file($fullPath)
) {
    fail(404, 'File not found');
}

// ── Stream file ────────────────────────────────────────────────────────────────
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $fullPath);
finfo_close($finfo);

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($fullPath));
header('Content-Disposition: inline; filename="' . basename($fullPath) . '"');
header('Cache-Control: private, max-age=300');
header('X-Content-Type-Options: nosniff');

readfile($fullPath);
