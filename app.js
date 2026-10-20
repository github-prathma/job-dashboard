(() => {
  const C = window.JD_CONFIG;
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly';
  const $ = (id) => document.getElementById(id);
  const fmt = d3.format(',');
  const pct = d3.format('.0%');
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const STATUSES = ['Ready to apply', 'Applied', 'Referral requested', 'Interviewing', 'Offer', 'Rejected', 'Skipped'];
  const SVAR = { 'Ready to apply': '--s-ready', 'Applied': '--s-applied', 'Referral requested': '--s-referral', 'Interviewing': '--s-interview', 'Offer': '--s-offer', 'Rejected': '--s-rejected', 'Skipped': '--s-skipped' };
  const sColor = (s) => `var(${SVAR[s] || '--s-skipped'})`;
  const AVATAR = ['#2563eb', '#0ea5e9', '#8b5cf6', '#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1', '#ec4899'];
  const PALETTE = ['--brand', '--s-referral', '--s-offer', '--s-ready', '--s-rejected', '--brand-2', '--s-interview', '--s-applied'];

  let token = null, tokenExpiry = 0, tokenClient = null, pendingResolve = null;
  let jobs = [], runs = [], lastLoaded = null, timer = null, usingSample = false, realData = null;
  let sortKey = 'Match Score', sortDir = -1, statusFilter = '';

  const todayPT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  const statusOf = (r) => String(r['Status'] || '').trim() || 'Ready to apply';
  const safeUrl = (u) => (/^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null);
  const scoreColor = (s) => (s >= 85 ? 'var(--s-offer)' : s >= 75 ? 'var(--brand)' : 'var(--s-ready)');
  const icon = (name, cls = 'ic sm') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + name); s.append(u); return s; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const fmtDay = (s) => { const d = new Date(String(s).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? String(s) : d3.utcFormat('%b %-d')(d); };

  document.querySelectorAll('[data-link]').forEach((a) => { a.href = C.LINKS[a.dataset.link]; });
  $('k-limit').textContent = 'of ' + C.DAILY_LIMIT;
  $('side-limit').textContent = C.DAILY_LIMIT + ' jobs';

  // ---------- Screens ----------
  function showGate(mode, error) {
    $('app').hidden = true; $('gate').hidden = false;
    $('gate-signin').hidden = mode !== 'signin';
    $('gate-loading').hidden = mode !== 'loading';
    $('gate-err').textContent = error || '';
  }
  function showApp() {
    $('gate').hidden = true; $('app').hidden = false;
    route();
  }
  function clearToken() { token = null; tokenExpiry = 0; try { sessionStorage.removeItem('jd_tok'); } catch (e) {} }
  function showGateError(msg) { if ($('app').hidden) showGate('signin', msg); else $('app-err').textContent = msg; }

  // ---------- Google sign-in (token kept in memory and this tab only) ----------
  $('signin').disabled = true;
  function initAuth() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) { setTimeout(initAuth, 200); return; }
    if (C.GOOGLE_CLIENT_ID.startsWith('PASTE_')) { showGate('signin', 'Add your Google OAuth client ID to config.js first.'); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: C.GOOGLE_CLIENT_ID,
      scope: SCOPES,
      hint: C.GOOGLE_ACCOUNT_HINT,
      callback: (resp) => {
        if (resp.error) { showGateError('Sign-in failed: ' + resp.error); return; }
        token = resp.access_token;
        tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
        try { sessionStorage.setItem('jd_tok', JSON.stringify({ token, tokenExpiry })); } catch (e) {}
        if (pendingResolve) { pendingResolve(); pendingResolve = null; } else start();
      },
      error_callback: (err) => showGateError('Sign-in was closed or blocked (' + (err && err.type) + '). Allow pop-ups for this site and try again.'),
    });
    $('signin').disabled = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem('jd_tok') || 'null');
      if (saved && saved.tokenExpiry > Date.now()) { token = saved.token; tokenExpiry = saved.tokenExpiry; start(); }
    } catch (e) {}
  }
  $('signin').addEventListener('click', () => { if (tokenClient) { $('gate-err').textContent = ''; tokenClient.requestAccessToken({ prompt: '' }); } });
  $('signout').addEventListener('click', () => {
    if (token) google.accounts.oauth2.revoke(token, () => {});
    clearToken(); clearInterval(timer); lastLoaded = null; jobs = []; runs = []; usingSample = false; realData = null;
    showGate('signin');
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
    $('app-err').textContent = '';
    setUpdated('Refreshing…');
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
      const rows = values.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ''])));
      realData = { jobs: rows, runs: (drive.files || []).map((f) => ({ title: f.name, created: f.createdTime, link: f.webViewLink })) };
      if (!usingSample || rows.length) { usingSample = false; jobs = realData.jobs; runs = realData.runs; }
      lastLoaded = new Date();
      if (!$('app').hidden) render();
      setUpdated();
      return true;
    } catch (e) {
      $('app-err').textContent = 'Could not load data: ' + e.message;
      setUpdated();
      return e;
    }
  }
  function setUpdated(text) {
    const u = $('updated'); u.replaceChildren();
    if (text) { u.textContent = text; return; }
    if (!lastLoaded) return;
    u.append(el('i'), document.createTextNode('Live · updated ' + lastLoaded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
  }

  async function start() {
    showGate('loading');
    const ok = await load();
    if (ok !== true) {
      clearToken();
      showGate('signin', 'Could not load your tracker (' + ok.message.slice(0, 120) + '). Sign in with the Google account that owns the tracker, and check that the Sheets and Drive APIs are enabled.');
      return;
    }
    showApp();
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) load(); }, C.AUTO_REFRESH_MINUTES * 60000);
  }
  $('refresh').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token && lastLoaded && Date.now() - lastLoaded > 60000) load(); });

  // ---------- Sample data (preview only, clearly bannered) ----------
  function sampleData() {
    const cos = ['Northwind Pay', 'Ledgerline', 'Cobalt Labs', 'Brightpath AI', 'Fernwood Bank', 'Quill Commerce', 'Atlas Payroll', 'Meridian Cloud', 'Harbor Health Tech', 'Sable Systems'];
    const roles = ['Senior Software Engineer, Payments', 'Staff Engineer, Platform', 'Senior Full Stack Engineer', 'Senior Backend Engineer, Risk', 'Staff Software Engineer, AI Applications', 'Senior Software Engineer, Payroll'];
    const locs = ['San Francisco, CA', 'Remote (US)', 'Sunnyvale, CA', 'Mountain View, CA', 'San Jose, CA', 'Palo Alto, CA'];
    const srcs = ['Greenhouse', 'Ashby', 'Lever', 'LinkedIn', 'Company site'];
    const spons = ['Not stated', 'Not stated', 'Sponsors', 'Transfers welcome'];
    const stat = ['Ready to apply', 'Ready to apply', 'Ready to apply', 'Applied', 'Applied', 'Referral requested', 'Interviewing', 'Rejected', 'Offer', 'Skipped'];
    const out = []; const now = new Date();
    for (let i = 0; i < 34; i++) {
      const d = new Date(now); d.setDate(d.getDate() - Math.floor(i / 3));
      const day = d.toISOString().slice(0, 10);
      const s = stat[(i * 7) % stat.length];
      const ad = new Date(d); ad.setDate(ad.getDate() + 1);
      out.push({ 'Date Found': day, 'Company': cos[(i * 3) % cos.length], 'Job Title': roles[i % roles.length], 'Location': locs[(i * 5) % locs.length], 'Job Link': '', 'Source': srcs[(i * 2) % srcs.length],
        'Match Score': String(70 + ((i * 13) % 27)), 'Sponsorship Signal': spons[i % spons.length], 'Status': s,
        'Date Applied': ['Applied', 'Referral requested', 'Interviewing', 'Rejected', 'Offer'].includes(s) ? ad.toISOString().slice(0, 10) : '' });
    }
    return { jobs: out, runs: [0, 1, 2].map((k) => ({ title: `Run ${new Date(now - k * 43200000).toISOString().slice(0, 10)} ${k % 2 ? '5:43 PM' : '7:43 AM'} PT`, created: '', link: '' })) };
  }
  function setSample(on) {
    usingSample = on;
    const d = on ? sampleData() : (realData || { jobs: [], runs: [] });
    jobs = d.jobs; runs = d.runs; statusFilter = ''; $('q').value = '';
    render();
  }
  $('sample-off').addEventListener('click', () => setSample(false));

  // ---------- Derived numbers ----------
  function count(rows, key, fallback) {
    const n = {};
    for (const r of rows) { const k = String(r[key] || '').trim() || fallback; if (k) n[k] = (n[k] || 0) + 1; }
    return Object.entries(n).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }
  function derive() {
    const n = {}; for (const r of jobs) { const s = statusOf(r); n[s] = (n[s] || 0) + 1; }
    const g = (k) => n[k] || 0;
    const statusCounts = [...STATUSES, ...Object.keys(n).filter((s) => !STATUSES.includes(s))].map((status) => ({ status, jobs: g(status) }));
    const applied = g('Applied') + g('Referral requested') + g('Interviewing') + g('Offer') + g('Rejected');
    const funnel = [
      { label: 'Prepared', value: jobs.length - g('Skipped'), color: 'var(--brand)' },
      { label: 'Applied', value: applied, color: 'var(--s-applied)' },
      { label: 'Interviewing', value: g('Interviewing') + g('Offer'), color: 'var(--s-interview)' },
      { label: 'Offer', value: g('Offer'), color: 'var(--s-offer)' },
    ];
    const perDay = (key, pred) => { const d = {}; for (const r of jobs) { if (pred && !pred(r)) continue; const k = String(r[key] || '').trim().slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(k)) d[k] = (d[k] || 0) + 1; } return Object.keys(d).sort().map((date) => ({ date, value: d[date] })); };
    const byDay = perDay('Date Found');
    const appliedDays = perDay('Date Applied');
    let run = 0; const cumul = appliedDays.map((r) => ({ date: r.date, value: (run += r.value) }));
    return { statusCounts, funnel, byDay, appliedDays, cumul, g,
      byCompany: count(jobs, 'Company').slice(0, 7), bySource: count(jobs, 'Source', 'Unknown').slice(0, 6), bySpons: count(jobs, 'Sponsorship Signal', 'Not recorded').slice(0, 6) };
  }

  // ---------- Small builders ----------
  const btn = (text, url, iconName, color) => {
    const u = safeUrl(url);
    const a = el('a', 'btn sm'); if (color) a.style.setProperty('--b', color);
    if (iconName) a.append(icon(iconName));
    a.append(document.createTextNode(text));
    if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener'; } else { a.setAttribute('aria-disabled', 'true'); a.title = usingSample ? 'Sample data has no links' : 'Not available yet'; }
    return a;
  };
  const emptyBox = (box, text, iconName = 'inbox', action) => {
    const e = el('div', 'empty'); e.append(icon(iconName, 'ic'), el('div', null, text));
    if (action) e.append(action);
    box.replaceChildren(e);
  };
  const sampleButton = () => { const b = el('button', 'btn sm'); b.type = 'button'; b.append(icon('eye'), document.createTextNode('Preview with sample data')); b.addEventListener('click', () => setSample(true)); return b; };

  function hbars(box, rows, colorFor, onClick) {
    box.replaceChildren();
    if (!rows.length) return emptyBox(box, 'Nothing to show yet.');
    const max = Math.max(1, ...rows.map((r) => r.value));
    rows.forEach((r, i) => {
      const row = el('div', 'hb' + (onClick ? ' click' : ''));
      if (onClick) { row.tabIndex = 0; row.addEventListener('click', () => onClick(r)); row.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(r); }); row.title = 'Filter jobs by ' + r.label; }
      const t = el('div', 'hb-t'); const f = el('span'); f.style.width = (r.value / max * 100) + '%'; f.style.background = colorFor(r, i); t.append(f);
      row.append(el('span', 'hb-l', r.label), t, el('span', 'hb-v', fmt(r.value)));
      box.append(row);
    });
  }

  function sparkline(svgEl, rows, color) {
    const s = d3.select(svgEl); s.selectAll('*').remove();
    const data = rows.slice(-14);
    if (data.length < 2) return;
    const W = 90, H = 28;
    s.attr('viewBox', `0 0 ${W} ${H}`);
    const x = d3.scaleLinear([0, data.length - 1], [2, W - 2]);
    const y = d3.scaleLinear([0, d3.max(data, (d) => d.value) || 1], [H - 3, 3]);
    s.append('path').datum(data).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
      .attr('d', d3.line().x((d, i) => x(i)).y((d) => y(d.value)));
  }

  function addTip(box) { return d3.select(box).append('div').attr('class', 'tip'); }
  function showTip(tip, box, ev, lines) {
    const [mx, my] = d3.pointer(ev, box);
    tip.style('display', 'block').html('');
    tip.append('div').attr('class', 'd').text(lines[0]);
    tip.append('b').text(lines[1]);
    const tw = tip.node().offsetWidth;
    tip.style('left', Math.min(Math.max(0, mx + 12), box.clientWidth - tw) + 'px').style('top', Math.max(0, my - 44) + 'px');
  }
  function axes(svg, x, y, W, H, ml, xFmt) {
    const yA = svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'))).attr('font-size', null).attr('font-family', null);
    yA.select('.domain').remove();
    yA.selectAll('.tick line').attr('x2', W - ml - 4).attr('stroke', cssVar('--grid'));
    yA.selectAll('text').attr('fill', cssVar('--muted')).style('font-size', '11px');
    const xA = svg.append('g').attr('transform', `translate(0,${H - 24})`).call(xFmt).attr('font-size', null).attr('font-family', null);
    xA.select('.domain').attr('stroke', cssVar('--axis')); xA.selectAll('.tick line').remove();
    const labels = xA.selectAll('text').attr('fill', cssVar('--muted')).style('font-size', '11px');
    return labels;
  }
  function measureLeft(svg, y) {
    const g = svg.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d'))).attr('font-size', null).attr('font-family', null);
    g.selectAll('text').style('font-size', '11px');
    let w = 8; g.selectAll('text').each(function () { w = Math.max(w, this.getComputedTextLength() + 12); });
    g.remove(); return w;
  }
  function thin(labels, step) { let widest = 0; labels.each(function () { widest = Math.max(widest, this.getComputedTextLength()); }); if (widest + 8 > step) { const every = Math.ceil((widest + 8) / step); labels.attr('display', (d, i) => (i % every === 0 ? null : 'none')); } }

  function barChart(box, rows, opts) {
    box.replaceChildren();
    if (!rows.length) return emptyBox(box, opts.empty, 'bars');
    const W = Math.max(240, box.clientWidth || 320), H = 190;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const tip = addTip(box);
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const grad = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    grad.append('stop').attr('offset', 0).attr('stop-color', opts.c1);
    grad.append('stop').attr('offset', 1).attr('stop-color', opts.c2);
    const y = d3.scaleLinear([0, Math.max(opts.ref || 0, d3.max(rows, (d) => d.value) || 1)], [H - 24, 10]).nice();
    const ml = measureLeft(svg, y);
    const x = d3.scaleBand(rows.map((d) => d.key), [ml, W - 4]).padding(0.28);
    const labels = axes(svg, x, y, W, H, ml, d3.axisBottom(x).tickFormat(opts.xFmt || ((d) => d)));
    thin(labels, x.step());
    if (opts.ref) svg.append('line').attr('x1', ml).attr('x2', W - 4).attr('y1', y(opts.ref)).attr('y2', y(opts.ref)).attr('stroke', cssVar('--axis')).attr('stroke-dasharray', '4 4');
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (d) => x(d.key) + Math.max(0, (x.bandwidth() - 28) / 2)).attr('width', Math.min(28, x.bandwidth()))
      .attr('y', (d) => y(d.value)).attr('height', (d) => y(0) - y(d.value)).attr('rx', 5).attr('fill', `url(#${gid})`)
      .on('mousemove', (ev, d) => showTip(tip, box, ev, [opts.xFmt ? opts.xFmt(d.key) : d.key, `${fmt(d.value)} ${opts.unit}`]))
      .on('mouseleave', () => tip.style('display', 'none'));
  }

  function areaChart(box, rows, opts) {
    box.replaceChildren();
    if (rows.length < 1) return emptyBox(box, opts.empty, 'trend');
    const data = rows.map((r) => ({ d: new Date(r.date + 'T12:00:00Z'), value: r.value, date: r.date }));
    if (data.length === 1) data.unshift({ d: new Date(data[0].d - 86400000), value: 0, date: '' });
    const W = Math.max(240, box.clientWidth || 320), H = 190;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const tip = addTip(box);
    const color = opts.color;
    const gid = 'a' + Math.random().toString(36).slice(2, 8);
    const grad = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    [[0, .32], [.5, .1], [1, 0]].forEach(([o, a]) => grad.append('stop').attr('offset', o).attr('stop-color', color).attr('stop-opacity', a));
    const y = d3.scaleLinear([0, d3.max(data, (d) => d.value) || 1], [H - 24, 12]).nice();
    const ml = measureLeft(svg, y);
    const x = d3.scaleUtc(d3.extent(data, (d) => d.d), [ml + 4, W - 10]);
    const labels = axes(svg, x, y, W, H, ml, d3.axisBottom(x).ticks(Math.max(2, Math.floor(W / 80))).tickFormat(d3.utcFormat('%b %-d')));
    thin(labels, (W - ml) / Math.max(1, labels.size()));
    svg.append('path').datum(data).attr('fill', `url(#${gid})`).attr('d', d3.area().x((d) => x(d.d)).y0(y(0)).y1((d) => y(d.value)));
    svg.append('path').datum(data).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
      .attr('d', d3.line().x((d) => x(d.d)).y((d) => y(d.value)));
    const last = data[data.length - 1];
    svg.append('circle').attr('cx', x(last.d)).attr('cy', y(last.value)).attr('r', 4.5).attr('fill', color).attr('stroke', cssVar('--panel')).attr('stroke-width', 2);
    const dot = svg.append('circle').attr('r', 4).attr('fill', color).attr('display', 'none');
    const bis = d3.bisector((d) => d.d).center;
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml).attr('height', H - 24).attr('fill', 'transparent')
      .on('mousemove', (ev) => { const [mx] = d3.pointer(ev); const d = data[bis(data, x.invert(mx))]; dot.attr('display', null).attr('cx', x(d.d)).attr('cy', y(d.value)); showTip(tip, box, ev, [d3.utcFormat('%b %-d, %Y')(d.d), `${fmt(d.value)} applications`]); })
      .on('mouseleave', () => { dot.attr('display', 'none'); tip.style('display', 'none'); });
  }

  function donut(box, legendBox, rows) {
    box.replaceChildren(); legendBox.replaceChildren();
    const total = d3.sum(rows, (r) => r.jobs);
    const S = 170, R = S / 2, inner = R - 22;
    const svg = d3.select(box).append('svg').attr('width', S).attr('height', S).attr('viewBox', `0 0 ${S} ${S}`).style('display', 'block').style('margin', '0 auto');
    const g = svg.append('g').attr('transform', `translate(${R},${R})`);
    const tip = addTip(box);
    if (!total) g.append('circle').attr('r', (R + inner) / 2).attr('fill', 'none').attr('stroke', cssVar('--grid')).attr('stroke-width', R - inner);
    else {
      const arcs = d3.pie().sort(null).value((d) => d.jobs).padAngle(0.02)(rows.filter((r) => r.jobs > 0));
      g.selectAll('path').data(arcs).join('path').attr('d', d3.arc().innerRadius(inner).outerRadius(R).cornerRadius(4))
        .attr('fill', (d) => cssVar(SVAR[d.data.status] || '--s-skipped')).style('cursor', 'pointer')
        .attr('opacity', (d) => (!statusFilter || statusFilter === d.data.status ? 1 : 0.35))
        .on('click', (ev, d) => filterStatus(d.data.status))
        .on('mousemove', (ev, d) => showTip(tip, box, ev, [d.data.status, `${fmt(d.data.jobs)} jobs · ${pct(d.data.jobs / total)}`]))
        .on('mouseleave', () => tip.style('display', 'none'));
    }
    g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em').attr('fill', cssVar('--ink')).style('font-size', '28px').style('font-weight', 800).text(fmt(total));
    g.append('text').attr('text-anchor', 'middle').attr('dy', '1.5em').attr('fill', cssVar('--muted')).style('font-size', '12px').text('total jobs');
    for (const r of rows) {
      const b = el('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(statusFilter === r.status));
      const sw = el('i'); sw.style.background = sColor(r.status);
      b.append(sw, el('span', null, r.status), el('b', null, fmt(r.jobs)));
      b.addEventListener('click', () => filterStatus(r.status));
      legendBox.append(b);
    }
  }

  // ---------- Pages ----------
  const PAGES = {
    overview: { title: null, sub: null },
    analytics: { title: 'Analytics', sub: 'How your search is converting, and where the jobs come from' },
    jobs: { title: 'All jobs', sub: null },
    linkedin: { title: 'LinkedIn outreach', sub: "Draft an InMail or a connection note to anyone at a company you're applying to" },
    files: { title: 'Files and runs', sub: 'Agent run logs and the Drive files the agents use' },
  };
  let page = 'overview';
  const pageFromHash = () => { const k = (location.hash || '').replace(/^#\/?/, ''); return PAGES[k] ? k : 'overview'; };
  function go(name) { if (location.hash !== '#/' + name) location.hash = '#/' + name; else route(); }
  function route() {
    page = pageFromHash();
    document.querySelectorAll('.page').forEach((pg) => {
      const on = pg.dataset.page === page;
      pg.hidden = !on;
      if (on) { pg.classList.remove('enter'); void pg.offsetWidth; pg.classList.add('enter'); }
    });
    document.querySelectorAll('.nav a[data-page]').forEach((a) => { a.classList.toggle('on', a.dataset.page === page); if (a.dataset.page === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    render();
  }
  window.addEventListener('hashchange', () => { if (!$('app').hidden) route(); });

  function filterStatus(s) { statusFilter = s; $('q').value = ''; go('jobs'); }
  $('see-ready').addEventListener('click', () => filterStatus('Ready to apply'));

  // ---------- Sections ----------
  function renderQueue() {
    const box = $('queue');
    const ready = jobs.filter((r) => statusOf(r) === 'Ready to apply').sort((a, b) => (Number(b['Match Score']) || 0) - (Number(a['Match Score']) || 0)).slice(0, 4);
    if (!ready.length) {
      return emptyBox(box, jobs.length ? 'Nothing waiting. Every prepared job has a status.' : 'No jobs yet. The agents add up to 10 a day, starting with the next run.', 'target', jobs.length || usingSample ? null : sampleButton());
    }
    box.replaceChildren();
    for (const r of ready) {
      const q = el('div', 'q');
      const sc = Number(r['Match Score']) || 0;
      const s = el('div', 'q-score', String(r['Match Score'] || '—')); s.style.setProperty('--sc', scoreColor(sc)); s.title = 'Match score';
      const main = el('div', 'q-main');
      const u = safeUrl(r['Job Link']);
      const role = el(u ? 'a' : 'span', 'q-role', r['Job Title']); if (u) { role.href = u; role.target = '_blank'; role.rel = 'noopener'; }
      const meta = el('div', 'q-meta');
      const m1 = el('span'); m1.append(icon('building'), document.createTextNode(r['Company'] || '—'));
      const m2 = el('span'); m2.append(icon('pin'), document.createTextNode(r['Location'] || '—'));
      const m3 = el('span'); m3.append(icon('shield'), document.createTextNode(r['Sponsorship Signal'] || 'Not stated'));
      meta.append(m1, m2, m3); main.append(role, meta);
      const acts = el('div', 'q-acts');
      acts.append(btn('Apply', r['Job Link'], 'external', 'var(--brand)'), btn('Resume', r['Tailored Resume Link'], 'file', 'var(--s-ready)'), btn('Outreach', r['Outreach Drafts Link'], 'message', 'var(--s-referral)'));
      acts.firstChild.classList.add('primary');
      q.append(s, main, acts); box.append(q);
    }
  }

  function renderChips(statusCounts) {
    const box = $('chips'); box.replaceChildren();
    const mk = (label, value, n, color) => {
      const b = el('button', 'chip'); b.type = 'button'; b.style.setProperty('--sc', color); b.setAttribute('aria-pressed', String(statusFilter === value));
      b.append(el('i'), document.createTextNode(label), el('span', 'n', fmt(n)));
      b.addEventListener('click', () => { statusFilter = statusFilter === value ? '' : value; render(); });
      box.append(b);
    };
    mk('All', '', jobs.length, 'var(--muted)');
    for (const r of statusCounts) if (r.jobs) mk(r.status, r.status, r.jobs, sColor(r.status));
  }

  function renderJobs() {
    const body = $('body'), empty = $('jobs-empty');
    const q = $('q').value.trim().toLowerCase();
    const rows = jobs.filter((r) => (!statusFilter || statusOf(r) === statusFilter) &&
      (!q || ['Company', 'Job Title', 'Location', 'Status', 'Sponsorship Signal', 'Source'].some((k) => String(r[k] || '').toLowerCase().includes(q))));
    const num = sortKey === 'Match Score';
    rows.sort((a, b) => (num ? (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0) : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''))) * sortDir);
    document.querySelectorAll('th').forEach((th) => th.removeAttribute('aria-sort'));
    const th = document.querySelector(`th button[data-k="${sortKey}"]`);
    if (th) th.parentElement.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
    $('jobs-count').textContent = jobs.length ? `Showing ${fmt(rows.length)} of ${fmt(jobs.length)} jobs` : 'Every job the agents prepared';
    body.replaceChildren();
    empty.hidden = rows.length > 0;
    if (!rows.length) emptyBox(empty, jobs.length ? 'No jobs match these filters.' : 'No jobs yet. They appear here after each run (7:43 AM and 5:43 PM Pacific).', 'search');
    for (const r of rows) {
      const tr = el('tr');
      const td = (node, cls) => { const c = el('td', cls); if (node instanceof Node) c.append(node); else c.textContent = node ?? ''; tr.append(c); };
      const co = el('div', 'co'); const av = el('span', 'avatar', String(r['Company'] || '?').trim().charAt(0).toUpperCase()); av.style.setProperty('--av', AVATAR[hash(r['Company']) % AVATAR.length]);
      co.append(av, document.createTextNode(r['Company'] || '—')); td(co);
      const role = el('div', 'role'); const u = safeUrl(r['Job Link']);
      const t = el(u ? 'a' : 'span', null, r['Job Title']); if (u) { t.href = u; t.target = '_blank'; t.rel = 'noopener'; }
      role.append(t, el('small', null, [r['Location'], r['Source']].filter(Boolean).join(' · '))); td(role);
      const scv = Number(r['Match Score']) || 0;
      const sc = el('span', 'score'); sc.style.setProperty('--sc', scoreColor(scv));
      const bar = el('span', 'bar'); const fill = el('span'); fill.style.width = Math.max(0, Math.min(100, scv)) + '%'; bar.append(fill);
      sc.append(document.createTextNode(r['Match Score'] || '—'), bar); td(sc);
      td(el('span', 'spons', r['Sponsorship Signal'] || '—'), 'hide-sm');
      const pill = el('span', 'pill'); pill.style.setProperty('--sc', sColor(statusOf(r))); pill.append(el('i'), document.createTextNode(statusOf(r))); td(pill);
      td(r['Date Found'] ? fmtDay(r['Date Found']) : '—', 'hide-sm nowrap');
      const acts = el('div', 'acts');
      acts.append(btn('Apply', r['Job Link'], 'external', 'var(--brand)'), btn('Resume', r['Tailored Resume Link'], 'file', 'var(--s-ready)'), btn('Outreach', r['Outreach Drafts Link'], 'message', 'var(--s-referral)'), btn('', r['Company Folder'], 'folder'));
      const dr = el('button', 'btn sm'); dr.type = 'button'; dr.style.setProperty('--b', 'var(--brand)'); dr.title = 'Draft a LinkedIn message for this job';
      dr.append(icon('pen'), document.createTextNode('Message')); dr.addEventListener('click', () => prefillOutreach(r)); acts.append(dr);
      acts.lastChild.title = acts.lastChild.getAttribute('aria-disabled') ? acts.lastChild.title : 'Company folder';
      td(acts);
      body.append(tr);
    }
  }

  function renderRuns() {
    const box = $('runs');
    if (!runs.length) return emptyBox(box, 'No runs yet. The first log appears after the next scheduled run.', 'clock');
    box.replaceChildren();
    for (const r of runs) {
      const row = el('div', 'run');
      const ic = el('span', 'kpi-icon'); ic.style.setProperty('--k', 'var(--brand-2)'); ic.append(icon('file', 'ic'));
      const txt = el('div'); txt.append(el('b', null, r.title), el('small', null, r.created ? new Date(r.created).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Run log'));
      row.append(ic, txt, btn('Open', r.link, 'external'));
      box.append(row);
    }
  }

  function render() {
    if ($('app').hidden) return;
    $('sample-banner').hidden = !usingSample;
    const D = derive();
    const today = (D.byDay.find((x) => x.date === todayPT()) || {}).value || 0;
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    const ready = D.g('Ready to apply');
    const P = PAGES[page];
    $('greet').textContent = P.title || (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', Prathma';
    $('take').textContent = P.sub || (page === 'jobs'
      ? (jobs.length ? `${fmt(jobs.length)} jobs prepared · ${fmt(ready)} ready to apply` : 'Every job the agents prepare shows up here')
      : jobs.length === 0
        ? 'No jobs yet. The agents fill this in after their next run.'
        : `${fmt(ready)} ${ready === 1 ? 'job is' : 'jobs are'} ready to apply, and ${fmt(today)} of ${C.DAILY_LIMIT} were prepared today.`);
    const nb = $('nav-ready'); nb.hidden = !ready; nb.textContent = fmt(ready); nb.title = ready + ' ready to apply';

    $('k-today').textContent = fmt(today);
    $('k-meter').style.width = Math.min(100, (today / C.DAILY_LIMIT) * 100) + '%';
    $('k-ready').textContent = fmt(ready);
    $('k-applied').textContent = fmt(D.funnel[1].value);
    $('k-int').textContent = fmt(D.funnel[2].value);
    $('k-offer').textContent = fmt(D.funnel[3].value);
    $('k-int-sub').textContent = D.funnel[1].value ? `${pct(D.funnel[2].value / D.funnel[1].value)} of applications` : 'incl. offers';
    $('k-applied-sub').textContent = D.funnel[0].value ? `${pct(D.funnel[1].value / D.funnel[0].value)} of prepared` : 'all time';
    sparkline($('sp-ready'), D.byDay, cssVar('--s-ready'));
    sparkline($('sp-applied'), D.appliedDays, cssVar('--s-applied'));

    renderQueue();
    donut($('donut'), $('legend'), D.statusCounts);

    hbars($('funnel'), D.funnel, (r) => r.color);
    const conv = $('conv'); conv.replaceChildren();
    const p = D.funnel[0].value, a = D.funnel[1].value, i = D.funnel[2].value;
    [[p ? pct(a / p) : '—', 'apply rate'], [a ? pct(i / a) : '—', 'interview rate'], [i ? pct(D.funnel[3].value / i) : '—', 'offer rate']].forEach(([v, l]) => { const d = el('div'); d.append(el('b', null, v), el('span', null, l)); conv.append(d); });

    barChart($('daily'), D.byDay.slice(-14).map((d) => ({ key: d.date, value: d.value })), { unit: 'prepared', ref: C.DAILY_LIMIT, xFmt: fmtDay, c1: cssVar('--brand'), c2: cssVar('--s-referral'), empty: 'No jobs prepared yet.' });
    areaChart($('cumul'), D.cumul, { color: cssVar('--s-applied'), empty: 'Set Status and Date Applied in the tracker to see this grow.' });

    const bins = [['<70', 0, 70], ['70s', 70, 80], ['80s', 80, 90], ['90+', 90, 101]].map(([key, lo, hi]) => ({ key, value: jobs.filter((r) => { const s = Number(r['Match Score']); return !isNaN(s) && s >= lo && s < hi; }).length }));
    barChart($('scores'), jobs.length ? bins : [], { unit: 'jobs', c1: cssVar('--s-offer'), c2: cssVar('--brand-2'), empty: 'Scores appear once jobs are prepared.' });

    const sponsColor = (r) => (/sponsor|transfer/i.test(r.label) && !/no |not sponsor|unable/i.test(r.label) ? 'var(--s-offer)' : /not stated|not recorded/i.test(r.label) ? 'var(--s-ready)' : 'var(--s-referral)');
    hbars($('spons'), D.bySpons, sponsColor);
    hbars($('companies'), D.byCompany, (r, i) => `var(${PALETTE[i % PALETTE.length]})`, (r) => { statusFilter = ''; $('q').value = r.label; go('jobs'); });
    hbars($('sources'), D.bySource, (r, i) => `var(${PALETTE[(i + 3) % PALETTE.length]})`);

    renderChips(D.statusCounts);
    renderJobs();
    renderRuns();
    renderOutreachStatus();
  }

  // ---------- LinkedIn outreach ----------
  const LI_LIMIT = C.INMAIL_DAILY_LIMIT || 5;
  const LOG_KEY = 'jd_li_log';
  const readLog = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; } };
  const writeLog = (log) => { try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 200))); } catch (e) {} };
  const form = $('li-form');
  const fval = (n) => String(form.elements[n].value || '').trim();
  const inmailsToday = () => readLog().filter((x) => x.type === 'inmail' && x.day === todayPT()).length;
  const liUrl = (u) => (/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(u) ? u : null);

  function renderOutreachStatus() {
    const n = inmailsToday();
    $('li-count').textContent = fmt(n);
    $('li-count-of').textContent = `of ${LI_LIMIT} sent`;
    $('li-meter').style.width = Math.min(100, (n / LI_LIMIT) * 100) + '%';
    $('li-warn').hidden = !(n >= LI_LIMIT && form.elements.type.value === 'inmail');
    const box = $('li-log'); const log = readLog();
    $('li-clear').hidden = !log.length;
    if (!log.length) return emptyBox(box, 'Nothing sent yet. Mark a draft as sent and it shows up here.', 'message');
    box.replaceChildren(); const list = el('div', 'log');
    for (const x of log.slice(0, 25)) {
      const row = el('div', 'log-row');
      const ic = el('span', 'kpi-icon'); ic.style.setProperty('--k', x.type === 'inmail' ? 'var(--s-referral)' : 'var(--brand)'); ic.append(icon(x.type === 'inmail' ? 'mail' : 'user-plus', 'ic'));
      const t = el('div'); t.append(el('b', null, `${x.name} · ${x.company}`), el('small', null, `${x.type === 'inmail' ? 'InMail' : 'Connection note'} · ${x.role} · ${fmtDay(x.day)}`));
      const open = btn('Profile', x.profile, 'external');
      row.append(ic, t, open); list.append(row);
    }
    box.append(list);
  }

  function syncFormMode() {
    const note = form.elements.type.value === 'note';
    $('li-goal-wrap').hidden = note;
    renderOutreachStatus();
  }
  form.querySelectorAll('input[name="type"]').forEach((x) => x.addEventListener('change', syncFormMode));
  $('li-switch').addEventListener('click', () => { form.querySelector('input[value="note"]').checked = true; syncFormMode(); if (!$('li-drafts-card').hidden) form.requestSubmit(); });
  $('li-clear').addEventListener('click', () => { if (confirm('Clear the sent log in this browser?')) { writeLog([]); renderOutreachStatus(); } });
  form.addEventListener('reset', () => setTimeout(() => { $('li-drafts-card').hidden = true; $('li-err').textContent = ''; form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid')); syncFormMode(); }, 0));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const missing = ['name', 'company', 'role'].filter((n) => !fval(n));
    form.querySelectorAll('input').forEach((x) => x.removeAttribute('aria-invalid'));
    missing.forEach((n) => form.elements[n].setAttribute('aria-invalid', 'true'));
    if (missing.length) { $('li-err').textContent = 'Add the person\'s name, the company and the job title.'; form.elements[missing[0]].focus(); return; }
    $('li-err').textContent = '';
    const f = { type: form.elements.type.value, name: fval('name'), company: fval('company'), role: fval('role'), recipient: fval('recipient'), goal: fval('goal'), link: safeUrl(fval('link')) || '', profile: liUrl(fval('profile')) || '' };
    const { highlight, variants } = window.JD_OUTREACH.draft(f);
    const recip = { recruiter: 'a recruiter', manager: 'a hiring manager', engineer: 'an engineer on the team', connection: 'someone you know' }[f.recipient];
    $('li-drafts-hint').textContent = `${f.type === 'note' ? 'Connection notes' : 'InMails'} for ${recip} · leads with your ${highlight.area} experience`;
    const prof = $('li-profile');
    prof.href = f.profile || 'https://www.linkedin.com/search/results/people/?' + new URLSearchParams({ keywords: `${f.name} ${f.company}` });
    prof.lastChild.textContent = f.profile ? 'Open profile' : 'Find on LinkedIn';
    renderDrafts(f, variants);
    $('li-drafts-card').hidden = false;
    $('li-drafts-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function copy(text, b) {
    const done = () => { const old = b.lastChild.textContent; b.lastChild.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.lastChild.textContent = old; b.classList.remove('done'); }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => { prompt('Copy this:', text); });
    else prompt('Copy this:', text);
  }

  function renderDrafts(f, variants) {
    const box = $('li-drafts'); box.replaceChildren();
    const L = window.JD_OUTREACH.LIMITS;
    variants.forEach((v, i) => {
      const card = el('div', 'draft' + (f.type === 'note' ? ' note' : ''));
      const top = el('div', 'draft-top'); top.append(el('span', null, `Option ${i + 1}`));
      const count = el('span', 'count'); top.append(count); card.append(top);
      let subj = null;
      if (f.type === 'inmail') { subj = el('input'); subj.value = v.subject; subj.setAttribute('aria-label', 'Subject'); subj.maxLength = L.subject; card.append(subj); }
      const ta = el('textarea'); ta.value = v.body; ta.setAttribute('aria-label', 'Message'); card.append(ta);
      const limit = f.type === 'note' ? L.note : L.inmail;
      const upd = () => { const n = ta.value.length; count.textContent = `${n} / ${limit}`; count.classList.toggle('over', n > limit); };
      ta.addEventListener('input', upd); upd();
      const acts = el('div', 'draft-acts');
      const mk = (label, ic, fn, primary) => { const b = el('button', 'btn sm' + (primary ? ' primary' : '')); b.type = 'button'; b.append(icon(ic), document.createTextNode(label)); b.addEventListener('click', () => fn(b)); acts.append(b); return b; };
      if (subj) mk('Copy subject', 'copy', (b) => copy(subj.value, b));
      mk(f.type === 'note' ? 'Copy note' : 'Copy message', 'copy', (b) => copy(ta.value, b), true);
      mk('Mark as sent', 'check', (b) => {
        if (f.type === 'note' && ta.value.length > L.note) { count.classList.add('over'); alert('This note is over 200 characters. Shorten it before sending.'); return; }
        const log = readLog(); log.unshift({ day: todayPT(), at: Date.now(), type: f.type, name: f.name, company: f.company, role: f.role, recipient: f.recipient, profile: f.profile });
        writeLog(log); b.lastChild.textContent = 'Sent'; b.classList.add('done'); b.disabled = true; renderOutreachStatus();
      });
      card.append(acts); box.append(card);
    });
  }

  function prefillOutreach(r) {
    form.reset();
    setTimeout(() => {
      form.elements.company.value = r['Company'] || '';
      form.elements.role.value = r['Job Title'] || '';
      form.elements.link.value = safeUrl(r['Job Link']) || '';
      if (inmailsToday() >= LI_LIMIT) form.querySelector('input[value="note"]').checked = true;
      syncFormMode();
      go('linkedin');
      setTimeout(() => form.elements.name.focus(), 50);
    }, 0);
  }

  document.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'Match Score' || k === 'Date Found' ? -1 : 1; }
    renderJobs();
  }));
  $('q').addEventListener('input', renderJobs);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  initAuth();
})();
