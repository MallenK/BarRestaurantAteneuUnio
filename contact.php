<?php
/**
 * Ateneu Unió — Envío de reservas por correo
 * Recibe el formulario de #bookingForm (index.html) vía fetch/POST,
 * valida y sanea todo en servidor, y envía el email directamente
 * desde el servidor (sin servicios de terceros).
 */

header('Content-Type: application/json; charset=utf-8');

function fail($code, $error) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $error]);
    exit;
}

// Solo aceptar POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'method_not_allowed');
}

// ---------- Capa de seguridad básica ----------

// 1) Referer/Origin debe pertenecer al propio dominio (evita que otros
//    sitios usen este endpoint para enviar correo desde nuestro servidor).
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$host    = $_SERVER['HTTP_HOST'] ?? '';
if ($referer !== '' && $host !== '' && stripos($referer, $host) === false) {
    fail(403, 'bad_origin');
}

// 2) Honeypot: campo oculto que solo rellenan los bots.
//    Respondemos éxito para no delatar el honeypot, pero no enviamos nada.
if (!empty($_POST['website'])) {
    echo json_encode(['success' => true]);
    exit;
}

// 3) Señal anti-bot por tiempo: un envío en menos de 1.5s desde que se
//    cargó la página casi siempre es un script, no una persona.
$elapsed = (int)($_POST['elapsed_ms'] ?? 0);
if ($elapsed > 0 && $elapsed < 1500) {
    fail(429, 'too_fast');
}

// 4) Rate limiting básico por IP (fichero, sin base de datos):
//    máx. 1 envío cada 20s, máx. 8 envíos por hora.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateDir = __DIR__ . '/.rate_limit';
if (!is_dir($rateDir)) { @mkdir($rateDir, 0700); }
$rateFile = $rateDir . '/' . md5($ip) . '.json';

$now = time();
$minInterval = 20;
$maxPerHour  = 8;

$history = [];
if (is_readable($rateFile)) {
    $history = json_decode(file_get_contents($rateFile), true) ?: [];
}
$history = array_values(array_filter($history, fn($t) => $now - $t < 3600));

if (!empty($history) && ($now - max($history)) < $minInterval) {
    fail(429, 'rate_limited');
}
if (count($history) >= $maxPerHour) {
    fail(429, 'rate_limited');
}

// ---------- Validación de campos ----------

$name    = trim($_POST['user_name']  ?? '');
$phone   = trim($_POST['user_phone'] ?? '');
$date    = trim($_POST['date']       ?? '');
$time    = trim($_POST['time']       ?? '');
$guests  = trim($_POST['guests']     ?? '');
$message = trim($_POST['message']    ?? '');

if ($name === '' || $phone === '' || $date === '' || $time === '' || $guests === '' || $message === '') {
    fail(400, 'missing_fields');
}

if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
    fail(400, 'invalid_name');
}

// Teléfono: dígitos, espacios, +, guiones o paréntesis, 9-20 caracteres,
// con al menos 9 dígitos reales (evita cosas tipo "2355623").
if (!preg_match('/^[0-9+\s\-()]{9,20}$/', $phone) || preg_match_all('/\d/', $phone) < 9) {
    fail(400, 'invalid_phone');
}

// Fecha en formato ISO (así la envía siempre <input type="date">)
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    fail(400, 'invalid_date');
}
$dateParts = explode('-', $date);
if (!checkdate((int)$dateParts[1], (int)$dateParts[2], (int)$dateParts[0])) {
    fail(400, 'invalid_date');
}

// Hora en formato HH:MM
if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
    fail(400, 'invalid_time');
}

// Comensales: entero entre 1 y 100
if (!ctype_digit((string)$guests) || (int)$guests < 1 || (int)$guests > 100) {
    fail(400, 'invalid_guests');
}
$guests = (int)$guests;

if (mb_strlen($message) < 3 || mb_strlen($message) > 1000) {
    fail(400, 'invalid_message');
}

// Evita inyección de cabeceras de correo (nadie debería poder meter saltos de línea)
function clean_header($str) {
    return str_replace(["\r", "\n", "%0a", "%0d", "%0A", "%0D"], '', $str);
}
$name  = clean_header($name);
$phone = clean_header($phone);
// El mensaje sí puede tener saltos de línea (va en el cuerpo, no en cabeceras)
$message = str_replace(["\r\n", "\r"], "\n", $message);

// ---------- Envío ----------

$to      = 'montse.ateneu.unio@gmail.com';
$subject = "Nova reserva - $name ($date $time)";

$body  = "Nova sol·licitud de reserva — Ateneu Unió\n\n";
$body .= "Nom: $name\n";
$body .= "Telèfon: $phone\n";
$body .= "Data: $date\n";
$body .= "Hora: $time\n";
$body .= "Comensals: $guests\n\n";
$body .= "Missatge:\n$message\n";

// IMPORTANTE: cambia "no-reply@ateneuuniorestaurant.com" por una cuenta de correo
// real de tu dominio (creada en hPanel → Correo) si tienes una — mejora mucho
// que el correo no caiga en spam.
$fromEmail = 'no-reply@ateneuuniorestaurant.com';

$headers   = "From: Ateneu Unió Web <$fromEmail>\r\n";
$headers  .= "Reply-To: $fromEmail\r\n";
$headers  .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers  .= "X-Mailer: PHP/" . phpversion();

$sent = @mail($to, $subject, $body, $headers);

if ($sent) {
    // Solo registramos el envío en el rate limiter si realmente se envió
    $history[] = $now;
    @file_put_contents($rateFile, json_encode($history));
    echo json_encode(['success' => true]);
} else {
    fail(500, 'mail_failed');
}
