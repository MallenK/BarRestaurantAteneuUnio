(() => {
  const $ = sel => document.querySelector(sel);

  let allCards = [];

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(path, {
      method,
      headers,
      credentials: 'include', // envia la cookie de sessió de Better Auth
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try { data = await res.json(); } catch { data = { success: false, error: 'invalid_response' }; }

    if (res.status === 401) {
      location.href = '/login.html?next=' + encodeURIComponent(location.pathname);
    }
    return { ok: res.ok, status: res.status, data };
  }

  function showRaw(el, payload) {
    el.textContent = JSON.stringify(payload, null, 2);
  }

  function showStatus(el, ok, message) {
    el.textContent = message;
    el.className = 'status show ' + (ok ? 'ok' : 'err');
  }

  const ERROR_MESSAGES = {
    invalid_name: 'El nom ha de tenir entre 2 i 80 caràcters.',
    invalid_phone: 'Telèfon no vàlid.',
    invalid_email: 'Email no vàlid.',
    invalid_card_id: 'Card ID no vàlid (24 caràcters hexadecimals).',
    invalid_heading: 'El títol ha de tenir entre 1 i 100 caràcters.',
    invalid_body: 'El missatge ha de tenir entre 1 i 500 caràcters.',
    card_not_found: 'No existeix cap targeta amb aquest Card ID.',
    rate_limited: 'Massa peticions seguides — espera un moment.',
    wallet_provider_error: 'AddToWallet ha retornat un error (mira la resposta de l\'API).',
    unauthorized: 'Cal iniciar sessió.',
  };
  function humanError(data) {
    return ERROR_MESSAGES[data.error] || data.error || 'Error inesperat.';
  }

  // Deixa un botó en estat "carregant…" i el restaura en acabar, tant si
  // l'acció ha anat bé com si no — mateix vocabulari en tots els formularis.
  async function withLoading(btn, label, fn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  // --- Sessió actual + logout ---
  async function loadUser() {
    const res = await fetch('/api/auth/get-session', { credentials: 'include' });
    const data = await res.json().catch(() => null);
    if (data && data.user) {
      $('#userTag').textContent = data.user.email;
    }
  }
  loadUser();

  $('#logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    location.href = '/login.html';
  });

  // --- Health ---
  async function checkHealth() {
    const dot = $('#healthDot');
    const text = $('#healthText');
    try {
      const res = await fetch('/health');
      if (res.ok) {
        dot.className = 'dot ok';
        text.textContent = 'API activa';
      } else throw new Error('bad status');
    } catch {
      dot.className = 'dot bad';
      text.textContent = 'API inaccessible';
    }
  }
  checkHealth();
  setInterval(checkHealth, 30000);

  // --- 1. Crear targeta ---
  $('#createForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const status = $('#createStatus');
    const out = $('#createOut');
    const fd = new FormData(e.target);

    await withLoading(btn, 'Creant…', async () => {
      const { ok, data } = await api('/api/wallet/pass', {
        method: 'POST',
        body: {
          clientName: fd.get('clientName'),
          clientPhone: fd.get('clientPhone'),
          email: fd.get('email'),
        },
      });
      showRaw(out, data);
      if (ok && data.cardId) {
        showStatus(status, true, data.reused ? 'Aquest telèfon ja tenia targeta — reutilitzada.' : 'Targeta creada correctament.');
        $('#s_cardId').value = data.cardId;
        $('#l_cardId').value = data.cardId;
        $('#n_cardId').value = data.cardId;
        e.target.reset();
      } else {
        showStatus(status, false, humanError(data));
      }
    });
  });

  // --- 2. Segellar targeta ---
  $('#stampForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const status = $('#stampStatus');
    const out = $('#stampOut');
    const cardId = e.target.cardId.value.trim();

    await withLoading(btn, 'Segellant…', async () => {
      const { ok, data } = await api('/api/wallet/stamp', { method: 'POST', body: { cardId } });
      showRaw(out, data);
      if (ok) {
        showStatus(status, true, data.rewardUnlocked
          ? `Premi desbloquejat! ${data.stamps}/${data.stampsToReward} segells.`
          : `Segell afegit: ${data.stamps}/${data.stampsToReward}.`);
      } else {
        showStatus(status, false, humanError(data));
      }
    });
  });

  // --- 3. Consultar targeta ---
  $('#lookupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const status = $('#lookupStatus');
    const out = $('#lookupOut');
    const cardId = e.target.cardId.value.trim();

    await withLoading(btn, 'Consultant…', async () => {
      const { ok, data } = await api(`/api/wallet/pass/${encodeURIComponent(cardId)}`);
      showRaw(out, data);
      if (ok) {
        showStatus(status, true, `${data.stamps}/${data.stampsToReward} segells${data.rewardUnlocked ? ' · premi disponible' : ''}.`);
      } else {
        showStatus(status, false, humanError(data));
      }
    });
  });

  // --- Enviar notificació ---
  $('#notifyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const status = $('#notifyStatus');
    const out = $('#notifyOut');
    const fd = new FormData(e.target);

    await withLoading(btn, 'Enviant…', async () => {
      const { ok, data } = await api('/api/wallet/notify', {
        method: 'POST',
        body: {
          cardId: fd.get('cardId'),
          heading: fd.get('heading'),
          body: fd.get('body'),
        },
      });
      showRaw(out, data);
      if (ok) {
        showStatus(status, true, 'Missatge enviat (visible dins la targeta, no com a push).');
      } else {
        showStatus(status, false, humanError(data));
      }
    });
  });

  // --- 4. Llistat ---
  function stampPillHtml(card) {
    const pct = Math.min(100, Math.round((card.stamps / card.stampsToReward) * 100));
    const cls = card.rewardUnlocked ? 'stamp-pill reward' : 'stamp-pill';
    return `
      <span class="${cls}">
        ${card.stamps}/${card.stampsToReward}
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      </span>`;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  function renderCards(cards) {
    const tbody = $('#cardsTable tbody');
    tbody.innerHTML = '';

    if (cards.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Cap targeta coincideix.</td></tr>`;
      return;
    }

    cards.forEach(card => {
      const tr = document.createElement('tr');
      const updated = card.updatedAt ? new Date(card.updatedAt).toLocaleString('ca-ES') : '—';

      tr.innerHTML = `
        <td>${escapeHtml(card.clientName)}</td>
        <td>${escapeHtml(card.clientPhone)}</td>
        <td>${stampPillHtml(card)}</td>
        <td>${updated}</td>
        <td>${card.passUrl ? `<a href="${escapeAttr(card.passUrl)}" target="_blank" rel="noopener">obrir</a>` : '—'}</td>
        <td></td>
      `;

      const actionCell = tr.lastElementChild;
      actionCell.style.display = 'flex';
      actionCell.style.gap = '6px';

      const stampBtn = document.createElement('button');
      stampBtn.className = 'btn btn-small';
      stampBtn.textContent = '+1 segell';
      stampBtn.addEventListener('click', async () => {
        await withLoading(stampBtn, '…', async () => {
          const { data } = await api('/api/wallet/stamp', { method: 'POST', body: { cardId: card.cardId } });
          showRaw($('#listOut'), data);
          if (data.success) refreshList();
        });
      });
      actionCell.appendChild(stampBtn);

      const resyncBtn = document.createElement('button');
      resyncBtn.className = 'btn btn-ghost btn-small';
      resyncBtn.textContent = 'Reparar';
      resyncBtn.title = 'Reenvia el disseny complet (colors, logo, textos) a AddToWallet';
      resyncBtn.addEventListener('click', async () => {
        await withLoading(resyncBtn, '…', async () => {
          const { data } = await api('/api/wallet/resync', { method: 'POST', body: { cardId: card.cardId } });
          showRaw($('#listOut'), data);
        });
      });
      actionCell.appendChild(resyncBtn);

      tbody.appendChild(tr);
    });
  }

  function applyFilter() {
    const q = $('#searchInput').value.trim().toLowerCase();
    if (!q) return renderCards(allCards);
    renderCards(allCards.filter(c =>
      c.clientName.toLowerCase().includes(q) || c.clientPhone.toLowerCase().includes(q),
    ));
  }
  $('#searchInput').addEventListener('input', applyFilter);

  function showTableSkeleton() {
    const tbody = $('#cardsTable tbody');
    tbody.innerHTML = Array.from({ length: 3 }).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton" style="width:120px"></div></td>
        <td><div class="skeleton" style="width:90px"></div></td>
        <td><div class="skeleton" style="width:70px"></div></td>
        <td><div class="skeleton" style="width:110px"></div></td>
        <td><div class="skeleton" style="width:40px"></div></td>
        <td></td>
      </tr>`).join('');
  }

  async function refreshList() {
    showTableSkeleton();
    const out = $('#listOut');
    const searchInput = $('#searchInput');
    const { ok, data } = await api('/api/wallet/cards');
    if (ok && data.success) {
      allCards = data.cards;
      searchInput.disabled = allCards.length === 0;
      applyFilter();
      out.textContent = '';
    } else {
      $('#cardsTable tbody').innerHTML = `<tr class="empty-row"><td colspan="6">${escapeHtml(humanError(data))}</td></tr>`;
      showRaw(out, data);
    }
  }
  $('#refreshListBtn').addEventListener('click', () => withLoading($('#refreshListBtn'), 'Carregant…', refreshList));

  refreshList();
})();
