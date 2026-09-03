
const form = document.getElementById("bookingForm");
const success = document.getElementById("formSuccess");
const errorSend = document.getElementById("formErrorSend");
const errorIncomplete = document.getElementById("formErrorIncomplete");
const submit = form.querySelector('button[type="submit"]');
const submitLabel = submit.textContent;

// Timestamp de carga del formulario: se usa como señal anti-bot básica
// (un envío en menos de ~1.5s desde que se pintó la página es casi
// siempre un script, no una persona rellenando el formulario).
const formLoadedAt = Date.now();

function resetMessages(){
  success.style.display = 'none';
  errorSend.hidden = true;
  errorIncomplete.hidden = true;
}

function validateForm(){
  // Primero, validación nativa del navegador (pattern, minlength, type=tel, etc.)
  const nativelyValid = form.checkValidity();

  // Además, marcamos visualmente qué campos concretos fallan
  const fields = ['user_name', 'user_phone', 'date', 'time', 'guests', 'message'];
  let valid = nativelyValid;
  fields.forEach(name => {
    const el = form.querySelector(`[name="${name}"]`);
    const wrapper = el ? el.closest('.field') : null;
    if (!wrapper) return;
    const fieldValid = el.value.trim() !== '' && el.checkValidity();
    wrapper.classList.toggle('field-error', !fieldValid);
    if (!fieldValid) valid = false;
  });

  if (!nativelyValid) form.reportValidity();
  return valid;
}

form.addEventListener("submit", async function(e){
  e.preventDefault();
  resetMessages();

  if (!validateForm()) {
    errorIncomplete.hidden = false;
    return;
  }

  submit.disabled = true;
  submit.textContent = '…';

  // Cortamos la petición si el servidor no responde en 15s, para que el
  // botón nunca se quede bloqueado indefinidamente.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const fd = new FormData(form);
    fd.append('elapsed_ms', String(Date.now() - formLoadedAt));

    const res = await fetch('contact.php', {
      method: 'POST',
      body: fd,
      signal: controller.signal
    });

    let data;
    try { data = await res.json(); } catch(_) { data = { success: false }; }

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'send_failed');
    }

    if (typeof gtag === 'function') {
      gtag('event', 'generate_lead', { form_type: 'reservation' });
    }

    success.style.display = 'block';
    form.reset();

  } catch (err) {
    console.error('Contact form error:', err);
    errorSend.hidden = false;

  } finally {
    clearTimeout(timeout);
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
});
