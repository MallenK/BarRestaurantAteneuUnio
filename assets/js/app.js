console.log("✅ app.js cargado correctamente");
(() => {
  console.log("BARRESTAURANT");
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const currentLang = () => document.documentElement.getAttribute('lang') || 'ca';

  // Nav responsive
  const nav = $('#siteNav');
  const toggle = $('#navToggle');
  if (toggle) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    document.addEventListener('click', e => { if (!nav.contains(e.target) && e.target !== toggle) nav.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') nav.classList.remove('open'); });
  }

  // Smooth scroll offset
  function smoothTo(hash){
    const target = document.getElementById(hash.replace('#',''));
    if (!target) return;
    const headerH = $('header').offsetHeight + 8;
    const y = target.getBoundingClientRect().top + window.pageYOffset - headerH;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  $$('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const href = a.getAttribute('href');
      if (href.length > 1) { e.preventDefault(); smoothTo(href); nav.classList.remove('open'); }
    });
  });

  // Active link on scroll + fallback
  const sections = ['sobre','arribar','carta','horaris','reserves','galeria','contacte'];
  const links = sections.map(id => ({id, el: document.querySelector(`nav a[href="#${id}"]`)}));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.el && l.el.classList.toggle('active', `#${entry.target.id}` === l.el.getAttribute('href')));
        }
      });
    }, { rootMargin: '-60% 0px -35% 0px', threshold: 0.01 });
    sections.forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
  } else {
    links.forEach(l => l.el && l.el.addEventListener('click', () => {
      links.forEach(m => m.el && m.el.classList.remove('active'));
      l.el.classList.add('active');
    }));
  }

  // Footer year
  $('#year').textContent = new Date().getFullYear();

  // Tabs (ARIA)
  const tablist = document.querySelector('[role="tablist"]');
  const tabs = $$('[role="tab"]', tablist);
  const panels = $$('[role="tabpanel"]');
  function activateTab(tab){
    tabs.forEach(t=>{ t.setAttribute('aria-selected', String(t===tab)); t.tabIndex = t===tab ? 0 : -1; });
    panels.forEach(p=> p.hidden = (p.getAttribute('aria-labelledby') !== tab.id));
    try { sessionStorage.setItem('activeTab', tab.id); } catch(e) {}
    tab.focus();
  }
  tabs.forEach(t=>{
    t.addEventListener('click', ()=>activateTab(t));
    t.addEventListener('keydown', e=>{
      const i = tabs.indexOf(document.activeElement);
      if (e.key==='ArrowRight') { e.preventDefault(); activateTab(tabs[(i+1)%tabs.length]); }
      if (e.key==='ArrowLeft')  { e.preventDefault(); activateTab(tabs[(i-1+tabs.length)%tabs.length]); }
      if (e.key==='Home') { e.preventDefault(); activateTab(tabs[0]); }
      if (e.key==='End')  { e.preventDefault(); activateTab(tabs[tabs.length-1]); }
    });
  });
  const saved = (()=>{ try { return sessionStorage.getItem('activeTab'); } catch(e){ return null; } })();
  if (saved) {
    const t = document.getElementById(saved);
    if (t) activateTab(t);
  } else {
    activateTab(document.getElementById('tab-tapes'));
  }

  // i18n
  const dict = {
    ca: {
      'nav.sobre':'Sobre', 'nav.arribar':'Arribar','nav.carta':'Carta','nav.horaris':'Horaris','nav.reserves':'Reserves','nav.galeria':'Galeria','nav.contacte':'Contacte',
      'hero.title':'Ateneu Unió · Bar Restaurant','hero.desc':'Cuina mediterrània, tapes i bocates al cor de la Colònia Güell.',
      'cta.reservar':'Reserva taula','cta.vercarta':'Veure carta',
      'info.horari':'Horari','info.tel':'Telèfon','info.adreca':'Adreça',
      'sobre.titulo':'Sobre nosaltres','sobre.p1':'A l’Ateneu Unió, t’obrim les portes a la Plaça Joan Güell, al cor de la Colònia Güell, un entorn ple d’història i encant modernista. Som punt de trobada per a famílies i visitants que volen gaudir d’una cuina casolana i propera.',
      'sobre.p2':'Menú del dia variable, tapes clàssiques i bocates freds i calents. Terrassa a la plaça i ambient tranquil.',
      'sobre.politica':'Política de cancel·lació: Guardem el dret de cancel·lar una reserva.',
      'sobre.comArribar':'Com arribar','sobre.adreca':'Adreça','sobre.transport':'Transport','sobre.transportTxt':'Autobús L76 · FGC (parada Colònia Güell)','sobre.abrirmapa':'Obrir a Google Maps',
      'carta.titulo':'Carta','carta.sub':'El menú del dia es modifica cada dia. Consulta’l al restaurant. A continuació, tapes i bocates amb preus.','carta.tapes':'Tapes','carta.freds':'Freds','carta.calents':'Calents','carta.croquetesPrecio':'1,00 € / unitat',
      'calents.bacon':'Bacó','calents.llom':'Llom','calents.salsitxes':'Saltxixes','calents.botifarra':'Botifarra','calents.xistorra':'Xistorra','calents.pit':'Pit de pollastre','calents.bikini':'Bikini','calents.bikiniMallorqui':'Bikini Mallorquí',
      'horaris.titulo':'Horaris',
      'dias.dilluns':'Dilluns','dias.dimarts':'Dimarts','dias.dimecres':'Dimecres','dias.dijous':'Dijous','dias.divendres':'Divendres','dias.dissabte':'Dissabte','dias.diumenge':'Diumenge',
      'reserves.titulo':'Reserves','reserves.tel':'Telèfon','reserves.confauto':'Confirmació automàtica','reserves.noauto':'No (contacte per telèfon o email)','reserves.btnTrucar':'Trucar','reserves.btnEmail':'Enviar email',
      'resenas.titulo':'Reseñas',
      'rev.1':'Cuina casolana excel·lent i tracte de 10. Les braves són top.','rev.2':'Terrassa molt agradable a la plaça. Repetirem.','rev.3':'Croquetes casolanes i carns al punt. Molt recomanable.',
      'contacte.titulo':'Contacte i xarxes','contacte.verficha':'Veure fitxa','contacte.comarribar':'Com arribar',
      'legal.aviso':'Avís legal','legal.priv':'Privacitat','legal.cookies':'Cookies'
    },
    es: {
      'nav.sobre':'Sobre','nav.arribar':'Cómo llegar','nav.carta':'Carta','nav.horaris':'Horarios','nav.reserves':'Reservas','nav.galeria':'Galería','nav.contacte':'Contacto',
      'hero.title':'Ateneu Unió · Bar Restaurante','hero.desc':'Cocina mediterránea, tapas y bocatas en el corazón de la Colonia Güell.',
      'cta.reservar':'Reservar mesa','cta.vercarta':'Ver carta',
      'info.horari':'Horario','info.tel':'Teléfono','info.adreca':'Dirección',
      'sobre.titulo':'Sobre nosotros','sobre.p1':'En Ateneu Unió te abrimos las puertas en la Plaça Joan Güell, en la Colonia Güell, un entorno lleno de historia y encanto modernista. Punto de encuentro para familias y visitantes que quieren disfrutar de cocina casera y cercana.',
      'sobre.p2':'Menú del día variable, tapas clásicas y bocatas fríos y calientes. Terraza en la plaza y ambiente tranquilo.',
      'sobre.politica':'Política de cancelación: Nos reservamos el derecho de cancelar una reserva.',
      'sobre.comArribar':'Cómo llegar','sobre.adreca':'Dirección','sobre.transport':'Transporte','sobre.transportTxt':'Autobús L76 · FGC (parada Colonia Güell)','sobre.abrirmapa':'Abrir en Google Maps',
      'carta.titulo':'Carta','carta.sub':'El menú del día cambia a diario. Consúltalo en el restaurante. A continuación, tapas y bocatas con precios.','carta.tapes':'Tapas','carta.freds':'Fríos','carta.calents':'Calientes','carta.croquetesPrecio':'1,00 € / unidad',
      'calents.bacon':'Bacon','calents.llom':'Lomo','calents.salsitxes':'Salchichas','calents.botifarra':'Butifarra','calents.xistorra':'Chistorra','calents.pit':'Pechuga de pollo','calents.bikini':'Bikini','calents.bikiniMallorqui':'Bikini Mallorquín',
      'horaris.titulo':'Horarios',
      'dias.dilluns':'Lunes','dias.dimarts':'Martes','dias.dimecres':'Miércoles','dias.dijous':'Jueves','dias.divendres':'Viernes','dias.dissabte':'Sábado','dias.diumenge':'Domingo',
      'reserves.titulo':'Reservas','reserves.tel':'Teléfono','reserves.confauto':'Confirmación automática','reserves.noauto':'No (contacto por teléfono o email)','reserves.btnTrucar':'Llamar','reserves.btnEmail':'Enviar email',
      'resenas.titulo':'Reseñas',
      'rev.1':'Cocina casera excelente y trato de 10. Las bravas, top.','rev.2':'Terraza muy agradable en la plaza. Repetiremos.','rev.3':'Croquetas caseras y carnes al punto. Muy recomendable.',
      'contacte.titulo':'Contacto y redes','contacte.verficha':'Ver ficha','contacte.comarribar':'Cómo llegar',
      'legal.aviso':'Aviso legal','legal.priv':'Privacidad','legal.cookies':'Cookies'
    },
    en: {
      'nav.sobre':'About','nav.arribar':'Getting here','nav.carta':'Menu','nav.horaris':'Hours','nav.reserves':'Bookings','nav.galeria':'Gallery','nav.contacte':'Contact',
      'hero.title':'Ateneu Unió · Bar Restaurant','hero.desc':'Mediterranean food, tapas and sandwiches in the heart of Colònia Güell.',
      'cta.reservar':'Book a table','cta.vercarta':'See menu',
      'info.horari':'Hours','info.tel':'Phone','info.adreca':'Address',
      'sobre.titulo':'About us','sobre.p1':'At Ateneu Unió we welcome you to Plaça Joan Güell, in Colònia Güell, a setting full of history and modernist charm. A meeting point for families and visitors who want to enjoy homestyle cooking.',
      'sobre.p2':'Daily menu that changes, classic tapas and hot or cold sandwiches. Terrace on the square and a calm atmosphere.',
      'sobre.politica':'Cancellation policy: We reserve the right to cancel a booking.',
      'sobre.comArribar':'Getting here','sobre.adreca':'Address','sobre.transport':'Transport','sobre.transportTxt':'Bus L76 · FGC (Colònia Güell stop)','sobre.abrirmapa':'Open in Google Maps',
      'carta.titulo':'Menu','carta.sub':'The daily menu changes every day. Ask at the restaurant. Below you have tapas and sandwiches with prices.','carta.tapes':'Tapas','carta.freds':'Cold','carta.calents':'Hot','carta.croquetesPrecio':'€1.00 / unit',
      'calents.bacon':'Bacon','calents.llom':'Loin','calents.salsitxes':'Sausages','calents.botifarra':'Butifarra','calents.xistorra':'Chistorra','calents.pit':'Chicken breast','calents.bikini':'Ham & cheese toastie','calents.bikiniMallorqui':'Mallorcan toastie',
      'horaris.titulo':'Opening hours',
      'dias.dilluns':'Monday','dias.dimarts':'Tuesday','dias.dimecres':'Wednesday','dias.dijous':'Thursday','dias.divendres':'Friday','dias.dissabte':'Saturday','dias.diumenge':'Sunday',
      'reserves.titulo':'Bookings','reserves.tel':'Phone','reserves.confauto':'Automatic confirmation','reserves.noauto':'No (contact via phone or email)','reserves.btnTrucar':'Call','reserves.btnEmail':'Send email',
      'resenas.titulo':'Reviews',
      'rev.1':'Excellent homestyle cooking and top service. The bravas are great.','rev.2':'Very pleasant terrace on the square. We will come back.','rev.3':'Homemade croquettes and meats cooked just right. Highly recommended.',
      'contacte.titulo':'Contact & social','contacte.verficha':'See listing','contacte.comarribar':'Getting here',
      'legal.aviso':'Legal notice','legal.priv':'Privacy','legal.cookies':'Cookies'
    }
  };

  function applyI18n(lang){
    const map = dict[lang] || dict.ca;
    $$('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (map[key]) el.textContent = map[key]; });
    document.documentElement.setAttribute('lang', lang);
    $$('.lang button').forEach(b => b.setAttribute('aria-current', String(b.dataset.lang === lang)));
    try { localStorage.setItem('lang', lang); } catch(e) {}
    setHoursStatus();
  }

  // Hours status
  function setHoursStatus(){
    const d = new Date();
    const day = d.getDay();
    const now = d.getHours() + d.getMinutes()/60;
    const rows = $$('.hrow');
    rows.forEach(r => r.classList.toggle('today', Number(r.dataset.day) === day));
    const todayRow = rows.find(r => Number(r.dataset.day) === day);
    let open = false;
    if (todayRow){
      const o = Number(todayRow.dataset.open);
      const c = Number(todayRow.dataset.close);
      open = now >= o && now < c;
    }
    const chip = $('#openChip');
    if (chip){
      const lang = currentLang();
      chip.classList.toggle('open', open);
      chip.classList.toggle('closed', !open);
      chip.textContent = open ? (lang==='es' ? 'Abierto ahora' : lang==='en' ? 'Open now' : 'Obert ara') : (lang==='es' ? 'Cerrado ahora' : lang==='en' ? 'Closed now' : 'Tancat ara');
    }
  }

  // Init
  const initial = (()=>{ try { return localStorage.getItem('lang'); } catch(e){ return null; } })() || ((navigator.language||'ca').startsWith('es') ? 'es' : (navigator.language||'ca').startsWith('en') ? 'en' : 'ca');
  applyI18n(initial);
  $$('.lang button').forEach(btn => btn.addEventListener('click', () => applyI18n(btn.dataset.lang)));
  setHoursStatus();
  setInterval(setHoursStatus, 60000);
})();
