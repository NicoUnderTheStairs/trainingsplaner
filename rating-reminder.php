<?php
/**
 * Daily cron job: reminds users to rate trainings that took place yesterday
 * and haven't been rated yet. Creates an in-app notification and sends a
 * push (if the user has a registered FCM token).
 *
 * Deploy alongside push-lib.php and firebase-service-account.json to the
 * web root of https://www.h2.vbclimmattal.com, then add a cron job in the
 * cyon control panel that runs once daily at 08:00, e.g.:
 *   php /path/to/rating-reminder.php
 * or, if only HTTP cron is available, protect this script behind a
 * shared secret check (see CRON_SECRET below) and hit it with curl/wget.
 */

require __DIR__ . '/push-lib.php';

// If triggered over HTTP instead of CLI, require this secret as ?key=...
define('CRON_SECRET', '9rR5j98lWIjplGUrFVeu');

if (php_sapi_name() !== 'cli') {
    if (!hash_equals(CRON_SECRET, $_GET['key'] ?? '')) {
        http_response_code(401);
        exit('Unauthorized');
    }
}

date_default_timezone_set('Europe/Zurich');

function firestoreUrl(string $path): string {
    return 'https://firestore.googleapis.com/v1/projects/' . FCM_PROJECT_ID . '/databases/(default)/documents' . $path;
}

function firestoreRequest(string $accessToken, string $method, string $url, $body = null) {
    $ch = curl_init($url);
    $headers = [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
    ];
    $opts = [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($body);
    }
    curl_setopt_array($ch, $opts);
    $result = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, json_decode($result, true)];
}

function toIso(int $timestamp): string {
    return gmdate('Y-m-d\TH:i:s.000\Z', $timestamp);
}

try {
    $accessToken = getAccessToken(
        'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo 'getAccessToken failed: ' . $e->getMessage() . "\n";
    exit(1);
}

try {

// ── Yesterday's date range (local time, converted to UTC instants) ────────────
$todayStart     = mktime(0, 0, 0);
$yesterdayStart = strtotime('-1 day', $todayStart);
$yesterdayEnd   = $todayStart;

// ── Collection-group query across every users/{uid}/trainings subcollection ───
$query = [
    'structuredQuery' => [
        'from'  => [['collectionId' => 'trainings', 'allDescendants' => true]],
        'where' => [
            'compositeFilter' => [
                'op'      => 'AND',
                'filters' => [
                    [
                        'fieldFilter' => [
                            'field' => ['fieldPath' => 'date'],
                            'op'    => 'GREATER_THAN_OR_EQUAL',
                            'value' => ['timestampValue' => toIso($yesterdayStart)],
                        ],
                    ],
                    [
                        'fieldFilter' => [
                            'field' => ['fieldPath' => 'date'],
                            'op'    => 'LESS_THAN',
                            'value' => ['timestampValue' => toIso($yesterdayEnd)],
                        ],
                    ],
                ],
            ],
        ],
    ],
];

[$status, $rows] = firestoreRequest(
    $accessToken,
    'POST',
    firestoreUrl(':runQuery'),
    $query,
);

if ($status !== 200 || !is_array($rows)) {
    http_response_code(500);
    echo "Firestore query failed (HTTP $status): " . json_encode($rows) . "\n";
    exit(1);
}

$sent = 0;

foreach ($rows as $row) {
    $doc = $row['document'] ?? null;
    if (!$doc) continue;

    $fields = $doc['fields'] ?? [];
    if (!empty($fields['rating'])) continue; // already rated
    if (!empty($fields['ratingReminderSent']['booleanValue'])) continue; // already reminded

    // name: projects/{p}/databases/(default)/documents/users/{uid}/trainings/{trainingId}
    $parts = explode('/', $doc['name']);
    $uidIdx = array_search('users', $parts);
    $tidIdx = array_search('trainings', $parts);
    if ($uidIdx === false || $tidIdx === false) continue;
    $uid        = $parts[$uidIdx + 1];
    $trainingId = $parts[$tidIdx + 1];
    $title      = $fields['title']['stringValue'] ?? 'your training';

    // ── Create in-app notification ────────────────────────────────────────────
    $notifBody = [
        'fields' => [
            'type'      => ['stringValue' => 'rate_training'],
            'title'     => ['stringValue' => 'Rate your training'],
            'body'      => ['stringValue' => "How was \"$title\"? Give it a quick rating."],
            'link'      => ['stringValue' => "/training-detail/$uid/$trainingId"],
            'read'      => ['booleanValue' => false],
            'createdAt' => ['timestampValue' => toIso(time())],
        ],
    ];
    firestoreRequest($accessToken, 'POST', firestoreUrl("/notifications/$uid/items"), $notifBody);

    // ── Push (best effort) ──────────────────────────────────────────────────
    [$userStatus, $userDoc] = firestoreRequest($accessToken, 'GET', firestoreUrl("/users/$uid"));
    $fcmToken = $userDoc['fields']['fcmToken']['stringValue'] ?? null;
    if ($userStatus === 200 && $fcmToken) {
        sendFcmPush(
            $accessToken,
            $fcmToken,
            'Rate your training',
            "How was \"$title\"? Give it a quick rating.",
            "/training-detail/$uid/$trainingId",
        );
    }

    // ── Mark as reminded so we never send this twice ──────────────────────────
    firestoreRequest(
        $accessToken,
        'PATCH',
        firestoreUrl("/users/$uid/trainings/$trainingId") . '?updateMask.fieldPaths=ratingReminderSent',
        ['fields' => ['ratingReminderSent' => ['booleanValue' => true]]],
    );

    $sent++;
}

echo "Sent $sent rating reminder(s).\n";

} catch (Throwable $e) {
    http_response_code(500);
    echo 'Error: ' . $e->getMessage() . "\n";
    exit(1);
}
