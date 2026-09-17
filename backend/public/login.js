(() => {
  const form = document.getElementById('loginForm');
  const status = document.getElementById('loginStatus');

  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/admin/';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'status';

    const fd = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    const originalLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'Entrant…';

    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: fd.get('email'),
          password: fd.get('password'),
        }),
      });

      if (!res.ok) {
        let data;
        try { data = await res.json(); } catch { data = {}; }
        throw new Error(data.message || 'Credencials incorrectes');
      }

      location.href = next;

    } catch (err) {
      status.textContent = err.message || 'No s\'ha pogut iniciar sessió';
      status.className = 'status show err';
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });
})();
