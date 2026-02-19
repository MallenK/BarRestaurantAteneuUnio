
const form = document.getElementById("bookingForm");
const success = document.getElementById("formSuccess");

form.addEventListener("submit", function(e){
  e.preventDefault();

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
    form.reset();

  }, err=>{
    console.error("EmailJS error:", err);
  });
});
