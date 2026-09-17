
// URL pública del backend de wallet (backend/, desplegat per separat —
// veure backend/README.md). Canvia-la un cop el servei estigui desplegat.
const WALLET_API_BASE = window.WALLET_API_BASE || 'https://api.ateneuuniorestaurant.com';

const form = document.getElementById("fidelitatForm");
const success = document.getElementById("fidSuccess");
const errorSend = document.getElementById("fidErrorSend");
const errorIncomplete = document.getElementById("fidErrorIncomplete");
const result = document.getElementById("fidResult");
const walletLink = document.getElementById("fidWalletLink");
const submit = form.querySelector('button[type="submit"]');
const submitLabel = submit.textContent;

// Igual que a assets/js/forms.js: señal anti-bot básica por tiempo de envío.
const formLoadedAt = Date.now();

function resetMessages(){
  success.style.display = 'none';
  errorSend.hidden = true;
  errorIncomplete.hidden = true;
}

function validateForm(){
  const nativelyValid = form.checkValidity();

  const fields = ['clientName', 'clientPhone'];
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

  // Honeypot: si un bot ha rellenado el campo oculto, abortamos en silencio.
  if (form.website.value) return;

  if (!validateForm()) {
    errorIncomplete.hidden = false;
    return;
  }

  const elapsed = Date.now() - formLoadedAt;
  if (elapsed < 1500) return;

  submit.disabled = true;
  submit.textContent = '…';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${WALLET_API_BASE}/api/wallet/pass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: form.clientName.value.trim(),
        clientPhone: form.clientPhone.value.trim(),
        email: form.email.value.trim(),
      }),
      signal: controller.signal,
    });

    let data;
    try { data = await res.json(); } catch(_) { data = { success: false }; }

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'send_failed');
    }

    success.textContent = 'Targeta creada! Ja pots afegir-la al teu mòbil.';
    success.style.display = 'block';

    walletLink.href = data.passUrl;
    result.classList.add('show');
    form.classList.add('hidden');

  } catch (err) {
    console.error('Wallet form error:', err);
    errorSend.hidden = false;

  } finally {
    clearTimeout(timeout);
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
});
