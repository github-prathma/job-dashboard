(() => {
  const C = window.JD_CONFIG;
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly';
  const $ = (id) => document.getElementById(id);
  const fmt = d3.format(',');
  const pct = d3.format('.0%');
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const STATUS_ORDER = ['Ready to apply', 'Applied', 'Referral requested', 'Interviewing', 'Offer', 'Rejected', 'Skipped'];
  const STATUS_COLOR = { 'Ready to apply': 'var(--c1)', 'Applied': 'var(--c5)', 'Referral requested': 'var(--c6)', 'Interviewing': 'var(--c3)', 'Offer': 'var(--c2)', 'Rejected': 'var(--c4)', 'Skipped': 'var(--c7)' };

  let token = null, tokenExpiry = 0, tokenClient = null, pendingResolve = null;
  let jobs = [], runs = [], lastLoaded = null, timer = null;
  let sortKey = 'Date Found', sortDir = -1, statusFilter = '';

  const todayPT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  const statusOf = (r) => String(r['Status'] || '').trim() || 'Ready to apply';
  const safeUrl = (u) => (/^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null);
  const scoreColor = (s) => (s >= 85 ? 'var(--c2)' : s >= 75 ? 'var(--c0)' : 'var(--c6)');

  document.querySelectorAll('[data-link]').forEach((a) => { a.href = C.LINKS[a.dataset.link]; });
  $('t-limit').textContent = `of the ${C.DAILY_LIMIT}-a-day limit`;

  // ---------- Google sign-in (token kept in memory and this tab only) ----------
  function initAuth() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) { setTimeout(initAuth, 200); return; }
    if (C.GOOGLE_CLIENT_ID.startsWith('PASTE_')) { $('gate-err').textContent = 'Add your Google OAuth client ID to config.js first.'; $('signin').disabled = true; return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: C.GOOGLE_CLIENT_ID,
      scope: SCOPES,
      hint: C.GOOGLE_ACCOUNT_HINT,
      callback: (resp) => {
        if (resp.error) { showGateError('Sign-in failed: ' + resp.error); return; }
        token = resp.access_token;
        tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
        try { sessionStorage.setItem('jd_tok', JSON.stringify({ token, tokenExpiry })); } catch (e) {}
        if (pendingResolve) { pendingResolve(); pendingResolve = null; }
        else start();
      },
      error_callback: (err) => showGateError('Sign-in was closed or blocked (' + (err && err.type) + '). Allow pop-ups and try again.'),
    });
    try {
      const saved = JSON.parse(sessionStorage.getItem('jd_tok') || 'null');
      if (saved && saved.tokenExpiry > Date.now()) { token = saved.token; tokenExpiry = saved.tokenExpiry; start(); }
    } catch (e) {}
  }
  function showGateError(msg) { $('gate-err').textContent = msg; $('app-err').textContent = msg; }
  $('signin').addEventListener('click', () => tokenClient && tokenClient.requestAccessToken({ prompt: '' }));
  $('signout').addEventListener('click', () => {
    if (token) google.accounts.oauth2.revoke(token, () => {});
    token = null; try { sessionStorage.removeItem('jd_tok'); } catch (e) {}
    clearInterval(timer); $('app').hidden = true; $('gate').hidden = false;
  });
  function ensureToken() {
    if (token && Date.now() < tokenExpiry) return Promise.resolve();
    return new Promise((resolve) => { pendingResolve = resolve; tokenClient.requestAccessToken({ prompt: '' }); });
  }
  async function api(url) {
    await ensureToken();
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) { token = null; await ensureToken(); return api(url); }
    if (!r.ok) { const t = await r.text(); throw new Error(`${r.status}: ${t.slice(0, 200)}`); }
    return r.json();
  }

  // ---------- Data ----------
  async function load() {
    $('updated').textContent = 'Refreshing…';
    $('app-err').textContent = '';
    try {
      const [sheet, drive] = await Promise.all([
        api(`https://sheets.googleapis.com/v4/spreadsheets/${C.TRACKER_SHEET_ID}/values/${encodeURIComponent(C.TRACKER_RANGE)}`),
        api('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
          q: `'${C.RUN_LOGS_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.document' and name contains 'Run ' and trashed = false`,
          orderBy: 'createdTime desc', pageSize: '8', fields: 'files(name,createdTime,webViewLink)',
        })),
      ]);
      const values = sheet.values || [];
      const cols = values[0] || [];
      jobs = values.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ''])));
      runs = (drive.files || []).map((f) => ({ title: f.name, created: f.createdTime, link: f.webViewLink }));
      lastLoaded = new Date();
      render();
    } catch (e) {
      $('app-err').textContent = 'Could not load data: ' + e.message + '. Make sure you signed in with the Google account that owns the tracker.';
    }
    $('updated').textContent = lastLoaded ? 'Updated ' + lastLoaded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  }

  function start() {
    $('gate').hidden = true; $('app').hidden = false;
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) load(); }, C.AUTO_REFRESH_MINUTES * 60000);
  }
  $('refresh').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token && lastLoaded && Date.now() - lastLoaded > 60000) load(); });

  // ---------- Derived numbers ----------
  function derive() {
    const n = {};
    for (const r of jobs) { const s = statusOf(r); n[s] = (n[s] || 0) + 1; }
    const g = (k) => n[k] || 0;
    const statusCounts = [...STATUS_ORDER, ...Object.keys(n).filter((s) => !STATUS_ORDER.includes(s))].map((status) => ({ status, jobs: g(status) }));
    const applied = g('Applied') + g('Referral requested') + g('Interviewing') + g('Offer') + g('Rejected');
    const funnel = [
      { stage: 'Prepared', jobs: jobs.length - g('Skipped') },
      { stage: 'Applied', jobs: applied },
      { stage: 'Interviewing', jobs: g('Interviewing') + g('Offer') },
      { stage: 'Offer', jobs: g('Offer') },
    ];
    const d = {};
    for (const r of jobs) { const k = String(r['Date Found'] || '').trim().slice(0, 10); if (k) d[k] = (d[k] || 0) + 1; }
    const byDay = Object.keys(d).sort().map((date) => ({ date, prepared: d[date] }));
    const c = {};
    for (const r of jobs) { const k = String(r['Company'] || '').trim(); if (k) c[k] = (c[k] || 0) + 1; }
    const byCompany = Object.entries(c).map(([company, n2]) => ({ company, jobs: n2 })).sort((a, b) => b.jobs - a.jobs || a.company.localeCompare(b.company)).slice(0, 10);
    return { statusCounts, funnel, byDay, byCompany, g };
  }

  // ---------- Rendering ----------
  const btn = (text, url, color) => {
    const u = safeUrl(url);
    const a = document.createElement('a'); a.className = 'btn sm'; a.style.setProperty('--b', color); a.textContent = text;
    if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener'; } else { a.setAttribute('aria-disabled', 'true'); a.title = 'Not available'; }
    return a;
  };
  const emptyBox = (el, text) => { el.replaceChildren(); const e = document.createElement('div'); e.className = 'empty'; e.textContent = text; el.append(e); };

  function hbars(el, rows, labelKey, valKey, colorFor, onClick) {
    el.replaceChildren();
    const max = Math.max(1, ...rows.map((r) => r[valKey]));
    rows.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'frow' + (onClick ? ' click' : '');
      if (onClick) { row.addEventListener('click', () => onClick(r)); row.title = 'Filter jobs by ' + r[labelKey]; }
      const l = document.createElement('span'); l.textContent = r[labelKey];
      const bar = document.createElement('div'); bar.className = 'fbar';
      const fill = document.createElement('span'); fill.style.width = (r[valKey] / max * 100) + '%'; fill.style.background = colorFor(r, i); bar.append(fill);
      const v = document.createElement('span'); v.className = 'fval'; v.textContent = fmt(r[valKey]);
      row.append(l, bar, v); el.append(row);
    });
  }

  function barChart(el, rows) {
    el.replaceChildren();
    if (!rows.length) return emptyBox(el, 'No jobs prepared yet. The first run fills this in.');
    const W = Math.max(260, el.clientWidth || 360), H = 200, ref = C.DAILY_LIMIT;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const tip = d3.select(el).append('div').attr('class', 'tip');
    const grad = svg.append('defs').append('linearGradient').attr('id', 'bargrad').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    grad.append('stop').attr('offset', 0).style('stop-color', css('--c0'));
    grad.append('stop').attr('offset', 1).style('stop-color', css('--c3'));
    const y = d3.scaleLinear([0, Math.max(ref, d3.max(rows, (d) => d.prepared) || 1)], [H - 28, 10]).nice();
    const yAxis = svg.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'))).attr('font-size', null).attr('font-family', null);
    let ml = 8; yAxis.selectAll('text').each(function () { ml = Math.max(ml, this.getComputedTextLength() + 12); });
    yAxis.attr('transform', `translate(${ml},0)`); yAxis.select('.domain').remove();
    yAxis.selectAll('.tick line').attr('x2', W - ml - 4).attr('stroke', 'var(--grid)');
    yAxis.selectAll('text').attr('fill', 'var(--muted)').style('font-size', '12px');
    const fmtDay = (s) => { const d = new Date(s + 'T12:00:00Z'); return isNaN(d) ? s : d3.utcFormat('%b %-d')(d); };
    const x = d3.scaleBand(rows.map((d) => d.date), [ml, W - 4]).padding(0.3);
    const xAxis = svg.append('g').attr('transform', `translate(0,${H - 28})`).call(d3.axisBottom(x).tickFormat(fmtDay)).attr('font-size', null).attr('font-family', null);
    xAxis.select('.domain').attr('stroke', 'var(--axis)'); xAxis.selectAll('.tick line').remove();
    const labels = xAxis.selectAll('text').attr('fill', 'var(--muted)').style('font-size', '12px');
    let widest = 0; labels.each(function () { widest = Math.max(widest, this.getComputedTextLength()); });
    if (widest + 6 > x.step()) { const every = Math.ceil((widest + 6) / x.step()); labels.attr('display', (d, i) => (i % every === 0 ? null : 'none')); }
    svg.append('line').attr('x1', ml).attr('x2', W - 4).attr('y1', y(ref)).attr('y2', y(ref)).attr('stroke', 'var(--axis)').attr('stroke-dasharray', '4 4');
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (d) => x(d.date) + Math.max(0, (x.bandwidth() - 32) / 2)).attr('width', Math.min(32, x.bandwidth()))
      .attr('y', (d) => y(d.prepared)).attr('height', (d) => y(0) - y(d.prepared)).attr('rx', 4).attr('fill', 'url(#bargrad)')
      .on('mousemove', (ev, d) => {
        const [mx, my] = d3.pointer(ev, el);
        tip.style('display', 'block').html('');
        tip.append('div').attr('class', 'd').text(fmtDay(d.date));
        tip.append('div').text(`${fmt(d.prepared)} prepared`);
        const tw = tip.node().offsetWidth;
        tip.style('left', Math.min(Math.max(0, mx + 10), el.clientWidth - tw) + 'px').style('top', Math.max(0, my - 40) + 'px');
      })
      .on('mouseleave', () => tip.style('display', 'none'));
  }

  function renderChips(statusCounts) {
    const el = $('chips'); el.replaceChildren();
    const mk = (label, value, count, color) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.style.setProperty('--sc', color);
      b.setAttribute('aria-pressed', String(statusFilter === value));
      b.append(document.createTextNode(label));
      const n = document.createElement('span'); n.className = 'n'; n.textContent = fmt(count); b.append(n);
      b.addEventListener('click', () => { statusFilter = statusFilter === value ? '' : value; renderChips(statusCounts); renderJobs(); });
      el.append(b);
    };
    mk('All', '', jobs.length, 'var(--c7)');
    for (const r of statusCounts) mk(r.status, r.status, r.jobs, STATUS_COLOR[r.status] || 'var(--c7)');
  }

  function renderJobs() {
    const body = $('body'), empty = $('jobs-empty');
    const q = $('q').value.trim().toLowerCase();
    let rows = jobs.filter((r) => (!statusFilter || statusOf(r) === statusFilter) &&
      (!q || ['Company', 'Job Title', 'Location', 'Status', 'Sponsorship Signal'].some((k) => String(r[k] || '').toLowerCase().includes(q))));
    const num = sortKey === 'Match Score';
    rows.sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      return (num ? (Number(av) || 0) - (Number(bv) || 0) : String(av).localeCompare(String(bv))) * sortDir;
    });
    document.querySelectorAll('th').forEach((th) => th.removeAttribute('aria-sort'));
    const th = document.querySelector(`th button[data-k="${sortKey}"]`);
    if (th) th.parentElement.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
    body.replaceChildren();
    empty.hidden = rows.length > 0;
    empty.textContent = jobs.length ? 'No jobs match these filters.' : 'No jobs yet. They appear here after each run (7:43 AM and 5:43 PM Pacific).';
    for (const r of rows) {
      const tr = document.createElement('tr');
      const td = (content, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; if (content instanceof Node) c.append(content); else c.textContent = content; tr.append(c); };
      td(r['Date Found']);
      td(r['Company'], 'co');
      const u = safeUrl(r['Job Link']);
      if (u) { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r['Job Title']; td(a, 'title'); } else td(r['Job Title'], 'title');
      td(r['Location'], 'hide-sm');
      const sc = document.createElement('span'); sc.className = 'score'; sc.textContent = r['Match Score']; sc.style.setProperty('--sc', scoreColor(Number(r['Match Score']) || 0)); td(sc);
      td(r['Sponsorship Signal'], 'hide-sm');
      const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = statusOf(r); pill.style.setProperty('--sc', STATUS_COLOR[statusOf(r)] || 'var(--c7)'); td(pill);
      const acts = document.createElement('div'); acts.className = 'acts';
      acts.append(btn('Apply ↗', r['Job Link'], 'var(--c0)'), btn('Resume', r['Tailored Resume Link'], 'var(--c1)'), btn('Outreach', r['Outreach Drafts Link'], 'var(--c4)'), btn('Folder', r['Company Folder'], 'var(--c7)'));
      td(acts);
      body.append(tr);
    }
  }

  function render() {
    const { statusCounts, funnel, byDay, byCompany, g } = derive();
    const today = (byDay.find((x) => x.date === todayPT()) || {}).prepared || 0;
    $('t-today').textContent = fmt(today);
    $('t-meter').style.width = Math.min(100, (today / C.DAILY_LIMIT) * 100) + '%';
    $('t-ready').textContent = fmt(g('Ready to apply'));
    $('t-applied').textContent = fmt(funnel[1].jobs);
    $('t-int').textContent = fmt(funnel[2].jobs);
    $('t-offer').textContent = fmt(funnel[3].jobs);
    $('take').textContent = jobs.length === 0
      ? 'No jobs prepared yet. The agents fill this page after their next run.'
      : `${fmt(g('Ready to apply'))} ${g('Ready to apply') === 1 ? 'job is' : 'jobs are'} ready to apply. ${fmt(today)} of ${C.DAILY_LIMIT} prepared today.`;

    const fc = ['var(--c0)', 'var(--c5)', 'var(--c3)', 'var(--c2)'];
    hbars($('funnel'), funnel, 'stage', 'jobs', (r, i) => fc[i]);
    const prep = funnel[0].jobs, app = funnel[1].jobs, int = funnel[2].jobs;
    $('conv').textContent = prep ? `Applied to ${pct(app / prep)} of prepared jobs` + (app ? ` · ${pct(int / app)} of applications reached interviews` : '') : '';

    barChart($('daily'), byDay.slice(-14));

    const comp = $('companies');
    if (!byCompany.length) emptyBox(comp, 'No jobs prepared yet.');
    else {
      const box = document.createElement('div'); box.className = 'bars'; comp.replaceChildren(box);
      const pal = ['--c0', '--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7'];
      hbars(box, byCompany, 'company', 'jobs', (r, i) => `var(${pal[i % pal.length]})`, (r) => {
        $('q').value = $('q').value === r.company ? '' : r.company; renderJobs();
        $('jobs').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    const re = $('runs');
    if (!runs.length) emptyBox(re, 'No runs yet. The first log appears after the next scheduled run.');
    else {
      re.replaceChildren();
      for (const r of runs) {
        const line = document.createElement('div'); line.className = 'run';
        const t = document.createElement('span'); t.textContent = r.title;
        line.append(t, btn('Open log ↗', r.link, 'var(--c5)')); re.append(line);
      }
    }
    renderChips(statusCounts);
    renderJobs();
  }

  document.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'Match Score' || k === 'Date Found' ? -1 : 1; }
    renderJobs();
  }));
  $('q').addEventListener('input', renderJobs);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (lastLoaded) barChart($('daily'), derive().byDay.slice(-14)); }, 200); });

  initAuth();
})();
