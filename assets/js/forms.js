
const form = document.getElementById("bookingForm");
const success = document.getElementById("formSuccess");
const errorSend = document.getElementById("formErrorSend");
const errorIncomplete = document.getElementById("formErrorIncomplete");
const submit = form.querySelector('button[type="submit"]');
const submitLabel = submit.textContent;

function resetMessages(){
  success.style.display = 'none';
  errorSend.hidden = true;
  errorIncomplete.hidden = true;
}

form.addEventListener("submit", function(e){
  e.preventDefault();
  resetMessages();

  // Validar campos requeridos
  const fields = ['user_name', 'user_phone', 'date', 'time', 'guests', 'message'];
  let valid = true;
  fields.forEach(name => {
    const el = form.querySelector(`[name="${name}"]`);
    const wrapper = el ? el.closest('.field') : null;
    if (!el || !el.value.trim()) {
      if (wrapper) wrapper.classList.add('field-error');
      valid = false;
    } else if (wrapper) {
      wrapper.classList.remove('field-error');
    }
  });

  if (!valid) {
    errorIncomplete.hidden = false;
    return;
  }

  // Desabilitar botón + mostrar estado
  submit.disabled = true;
  submit.textContent = '…';

  fetch('contact.php', {
    method: 'POST',
    body: new FormData(form)
  })
    .then(res => res.json().catch(()=>({success:false})).then(data => ({ok: res.ok, data})))
    .then(({ok, data}) => {
      if (!ok || !data.success) throw new Error(data.error || 'send_failed');

      // evento GA4
      if (typeof gtag === 'function') {
        gtag('event','generate_lead',{ form_type:'reservation' });
      }

      success.style.display = "block";
      form.reset();
    })
    .catch(err => {
      console.error("Contact form error:", err);
      errorSend.hidden = false;
    })
    .finally(() => {
      submit.disabled = false;
      submit.textContent = submitLabel;
    });
});
