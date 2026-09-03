
const form = document.getElementById("bookingForm");
const success = document.getElementById("formSuccess");
const submit = form.querySelector('button[type="submit"]');
const errorMsg = document.createElement('div');
errorMsg.id = 'formError';
errorMsg.style.display = 'none';
errorMsg.style.marginTop = '16px';
errorMsg.style.padding = '12px';
errorMsg.style.borderRadius = '0';
errorMsg.style.background = '#f8d7da';
errorMsg.style.border = '1px solid #E61919';
errorMsg.style.color = '#721c24';
errorMsg.style.textAlign = 'center';
errorMsg.style.fontFamily = '"IBM Plex Mono", monospace';
errorMsg.style.fontSize = '12px';
errorMsg.style.textTransform = 'uppercase';
form.appendChild(errorMsg);

form.addEventListener("submit", function(e){
  e.preventDefault();

  // Validar campos requeridos
  const fields = ['name', 'phone', 'date', 'time', 'guests', 'message'];
  let valid = true;
  fields.forEach(f => {
    const el = form.querySelector(`[name="user_${f}"], [name="${f}"]`);
    if (!el || !el.value.trim()) {
      el.style.borderColor = '#E61919';
      el.style.borderWidth = '1px';
      el.style.borderBottomWidth = '2px';
      valid = false;
    } else {
      el.style.borderColor = '';
      el.style.borderBottomWidth = '';
    }
  });

  if (!valid) {
    errorMsg.textContent = 'Completa tots els camps, per favor.';
    errorMsg.style.display = 'block';
    success.style.display = 'none';
    return;
  }

  // Desabilitar botón + mostrar estado
  submit.disabled = true;
  submit.textContent = 'Enviant...';
  errorMsg.style.display = 'none';
  success.style.display = 'none';

  emailjs.sendForm(
    "service_46idejm",
    "template_zxder7m",
    this
  ).then(()=>{

    // evento GA4
    gtag('event','generate_lead',{
      form_type:'reservation'
    });

    success.style.display="block";
    errorMsg.style.display = 'none';
    form.reset();
    submit.disabled = false;
    submit.textContent = form.querySelector('button[type="submit"]').getAttribute('data-i18n') ? 'Enviar' : 'Submit';

  }, err=>{
    console.error("EmailJS error:", err);
    errorMsg.textContent = 'Error en l\'envament. Prova de nou o truquem al ' + '931 253 062';
    errorMsg.style.display = 'block';
    success.style.display = 'none';
    submit.disabled = false;
    submit.textContent = form.querySelector('button[type="submit"]').getAttribute('data-i18n') ? 'Enviar' : 'Submit';
  });
});
