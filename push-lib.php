<?php
/**
 * Shared helpers for send-push.php and rating-reminder.php.
 * Deploy this file to the web root of https://www.h2.vbclimmattal.com,
 * alongside the other PHP scripts and firebase-service-account.json.
 *
 * firebase-service-account.json must NOT be renamed — it is the
 * Firebase Console "Generate new private key" download for this project,
 * placed directly next to this file (ideally outside the public web root).
 */

define('SERVICE_ACCOUNT_FILE', __DIR__ . '/firebase-service-account.json');
define('FCM_PROJECT_ID', 'trainingsplaner-796d3');

function base64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Mints a Google OAuth2 access token from the service account for the given
 * scopes (space-separated). Pass only the scopes you actually need.
 */
function getAccessToken(string $scopes) {
    $raw = file_get_contents(SERVICE_ACCOUNT_FILE);
    if ($raw === false) {
        throw new RuntimeException('Could not read ' . SERVICE_ACCOUNT_FILE);
    }
    $sa = json_decode($raw, true);
    if (!$sa || empty($sa['client_email']) || empty($sa['private_key'])) {
        throw new RuntimeException('Invalid service account JSON');
    }

    $now = time();
    $header = base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = base64url(json_encode([
        'iss'   => $sa['client_email'],
        'scope' => $scopes,
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ]));

    $sig = '';
    openssl_sign("$header.$claims", $sig, $sa['private_key'], 'SHA256');
    $jwt = "$header.$claims." . base64url($sig);

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        'ignore_errors' => true,
    ]]);
    $resp = file_get_contents('https://oauth2.googleapis.com/token', false, $ctx);
    $data = json_decode($resp, true);
    if (empty($data['access_token'])) {
        throw new RuntimeException('Failed to mint access token: ' . $resp);
    }
    return $data['access_token'];
}

/**
 * Sends a single FCM v1 push message. Returns [httpStatus, responseBody].
 */
function sendFcmPush(string $accessToken, string $token, string $title, string $body, string $link = '/') {
    $fcmPayload = json_encode([
        'message' => [
            'token'        => $token,
            'notification' => ['title' => $title, 'body' => $body],
            'webpush'      => ['fcmOptions' => ['link' => $link]],
            'data'         => ['link' => $link],
        ],
    ]);

    $ch = curl_init('https://fcm.googleapis.com/v1/projects/' . FCM_PROJECT_ID . '/messages:send');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => $fcmPayload,
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $result = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [$status, $result];
}
