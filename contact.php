<?php
/**
 * Ateneu Unió — Envío de reservas por correo
 * Recibe el formulario de #bookingForm (index.html) vía fetch/POST
 * y envía el email directamente desde el servidor (sin servicios de terceros).
 */

header('Content-Type: application/json; charset=utf-8');

// Solo aceptar POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'method_not_allowed']);
    exit;
}

// Honeypot anti-spam: campo oculto que solo rellenan los bots.
// Si viene relleno, respondemos éxito (para no delatar el honeypot) pero no enviamos nada.
if (!empty($_POST['website'])) {
    echo json_encode(['success' => true]);
    exit;
}

// Campos del formulario (deben coincidir con los `name` de index.html)
$name    = trim($_POST['user_name']  ?? '');
$phone   = trim($_POST['user_phone'] ?? '');
$date    = trim($_POST['date']       ?? '');
$time    = trim($_POST['time']       ?? '');
$guests  = trim($_POST['guests']     ?? '');
$message = trim($_POST['message']    ?? '');

// Validación básica en servidor (nunca confiar solo en la del navegador)
if ($name === '' || $phone === '' || $date === '' || $time === '' || $guests === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_fields']);
    exit;
}

// Evita inyección de cabeceras de correo (nadie debería poder meter saltos de línea)
function clean_header($str) {
    return str_replace(["\r", "\n", "%0a", "%0d", "%0A", "%0D"], '', $str);
}
$name   = clean_header($name);
$phone  = clean_header($phone);
$date   = clean_header($date);
$time   = clean_header($time);
$guests = clean_header($guests);
// El mensaje sí puede tener saltos de línea (va en el cuerpo, no en cabeceras)
$message = str_replace(["\r\n", "\r"], "\n", $message);

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
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'mail_failed']);
}
