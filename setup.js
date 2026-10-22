// First-run setup: one short screen (name, roles, resume), then creates the user's Job Agent workspace
// in their own Google Drive (folder, tracker sheet, search config, base resume).
// Uses only the drive.file permission, so the app can see nothing but these files.
window.JD_SETUP = (() => {
  const $ = (id) => document.getElementById(id);
  const DRIVE = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
  const FOLDER = 'application/vnd.google-apps.folder';
  const STATUSES = ['Ready to apply', 'Applied', 'Referral requested', 'Interviewing', 'Offer', 'Rejected', 'Skipped'];
  const HEADERS = {
    Jobs: ['Date Found', 'Company', 'Job Title', 'Location', 'Job Link', 'Source', 'Posted At', 'Match Score', 'Sponsorship Signal', 'H-1B History', 'Tailored Resume Link', 'Company Folder', 'Outreach Drafts Link', 'Status', 'Date Applied', 'Missing Keywords / Notes'],
    Outreach: ['Date Drafted', 'Company', 'Job Title', 'Job Link', 'Person', 'Person Title', 'Relationship', 'Found Via', 'Profile URL', 'Message Type', 'Subject', 'Message', 'Draft ID'],
    Runs: ['Run Time', 'Window', 'Found', 'Prepared', 'InMails Drafted Today', 'Log Link', 'Notes'],
    Profile: ['Field', 'Value', 'Short version', 'Area', 'Keywords', 'How to edit'],
  };
  const SHEET_IDS = { Outreach: 2001, Runs: 2002, Profile: 2003 };
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean);

  let ctx = null, step = 1, created = {}, retry = false;
  const form = () => $('su-form');
  const val = (n) => { const e = form().elements[n]; return e ? String(e.value || '').trim() : ''; };

  // ---------- Steps ----------
  function show(n) {
    step = n;
    form().querySelectorAll('section[data-step]').forEach((s) => { s.hidden = +s.dataset.step !== n; });
    document.querySelectorAll('#su-steps li').forEach((li) => {
      const k = +li.dataset.step; li.classList.toggle('on', k === n); li.classList.toggle('done', k < n);
    });
    $('su-back').style.visibility = n === 1 && (window.JD_CONFIG || {}).GOOGLE_API_KEY ? 'visible' : 'hidden';
    $('su-next').textContent = 'Create my workspace';
    $('su-nav').hidden = n !== 1;
    $('su-err').textContent = '';
    const f = form().querySelector(`section[data-step="${n}"] input:not([type=radio]):not([type=file])`);
    if (f && n === 1 && !f.value) setTimeout(() => f.focus(), 30);
    window.scrollTo(0, 0);
  }
  function validate(n) {
    const sec = form().querySelector(`section[data-step="${n}"]`);
    let bad = null;
    sec.querySelectorAll('input[required]').forEach((i) => {
      const ok = !!i.value.trim(); i.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = i;
    });

    const where = $('su-where').querySelector('summary');
    where.setAttribute('aria-invalid', String(!val('locations')));
    if (!bad && !val('locations')) { $('su-err').textContent = 'Pick at least one place you want to work.'; $('su-where').open = true; return false; }
    if (bad) { $('su-err').textContent = 'Please fill in the highlighted field.'; bad.focus(); return false; }
    return true;
  }

  // ---------- Google calls ----------
  const api = (...a) => ctx.api(...a);
  async function upload(meta, blob, mime) {
    const b = 'jdb' + Math.random().toString(36).slice(2);
    const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${b}--`]);
    return api(UPLOAD, { method: 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${b}` } });
  }
  const mkFolder = (name, parent, role) => api(DRIVE + '?fields=id', { json: { name, mimeType: FOLDER, parents: parent ? [parent] : undefined, appProperties: { jobAgentRole: role } } });
  const DOC = 'application/vnd.google-apps.document';
  const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', pdf: 'application/pdf', txt: 'text/plain', rtf: 'application/rtf', odt: 'application/vnd.oasis.opendocument.text' };

  function profileRows(a) {
    const help = 'Edit the Value column; the dashboard picks up changes when it refreshes. Highlight rows: Value finishes "I …", Short version is for 300-character connection notes, Area finishes "my background in …", Keywords are words in a job title or description that should pick this highlight.';
    const rows = [
      HEADERS.Profile,
      ['First name', a.firstName, '', '', '', help],
      ['Full name', a.fullName],
      ['Pitch', a.pitch, ''],
      ['Work authorization', a.needSponsorship === 'yes' ? a.sponsorship : '', ''],
      ['Schools', ''],
      ['Past employers', ''],
      ['Skills', ''],
      ['Highlight', '', '', '', ''],
      ['Morning run', a.morning],
      ['Evening run', a.evening],
      ['Time zone', a.tz],
      ['Daily job limit', String(a.dailyLimit)],
      ['InMails per day', '5'],
    ];
    return rows.map((r) => [...r, '', '', '', '', '', ''].slice(0, 6));
  }

  function configHtml(a) {
    const li = (items) => '<ul>' + items.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>';
    const watch = list(a.watchlist);
    return `<html><body>
<h1>SEARCH CONFIG (edit me)</h1>
<p>The agents read this doc at the start of every run, so changes take effect on the next run. Text in [brackets] is for you to fill in.</p>
<h2>1. Roles</h2>${li(['Titles to include: ' + a.roles, 'Titles to exclude: [e.g. Manager, Intern, QA]', 'Level: [e.g. senior to staff]'])}
<h2>2. Location</h2>${li(['Include: ' + a.locations, 'Exclude: [cities you don’t want]'])}
<h2>3. Work authorization / sponsorship</h2>${li(a.needSponsorship === 'yes'
      ? ['Needs visa sponsorship: Yes', 'Skip postings that say they can’t sponsor (e.g. "unable to sponsor", "must be a US citizen").', 'If the posting says nothing, keep it and check the company’s H-1B history.']
      : ['Needs visa sponsorship: No'])}
<h2>4. Freshness and volume</h2>${li(['Only postings since the previous run (at most the last 16 hours).', `At most ${a.dailyLimit} jobs a day; minimum match score 75.`, 'Diversity: at most 2 jobs per company a day.'])}
<h2>5. Companies to skip</h2>${li(list(a.skip).length ? list(a.skip) : ['[none yet]'])}
<h2>6. Watchlist (checked every run)</h2>${li(watch.length ? watch.map((c) => `${c}: [the agents find its job board]`) : ['[add companies you want checked every run]'])}
<h2>7. Broader discovery</h2>${li(['Also search LinkedIn Jobs, Indeed and company career pages (Greenhouse, Ashby, Lever) for the titles above.'])}
<h2>8. Resume tailoring rules</h2>${li(['Never invent skills, numbers or experience.', 'Reorder and reword bullets to use the job’s language only where it’s true.', 'Keep the same sections and length as the base resume.'])}
<h2>9. Outreach rules</h2>${li(['Up to 3 people per job: at most 1 recruiter, plus a hiring manager or engineer.', 'Recruiter titles: Technical Recruiter, Engineering Recruiter, Talent Partner (Engineering).', 'Don’t contact the same person again within 30 days.', 'People located in: [e.g. United States]', 'InMails per day: 5. After that, use connection notes (300 characters max).'] .concat(a.needSponsorship === 'yes' ? ['Work-authorization line for recruiters only: ' + a.sponsorship] : []))}
<h3>Templates</h3>${li(['A – message to a 1st-degree connection asking for a referral: [write yours, or let the agents draft one]', 'B – InMail to a recruiter: [...]', 'C – InMail to a hiring manager or engineer: [...]', 'D – connection note (300 characters max): [...]'])}
<h2>10. Application answers (for you to copy into forms)</h2>${li(['Need sponsorship: ' + (a.needSponsorship === 'yes' ? 'Yes' : 'No'), 'Willing to relocate: [...]', 'Earliest start date: [...]', 'Expected salary: [...]', 'Links: [LinkedIn, GitHub, portfolio]'])}
</body></html>`;
  }

  // ---------- Create everything ----------
  async function create() {
    const roles = val('roles');
    const a = {
      firstName: val('firstName'), fullName: val('fullName'),
      pitch: 'a ' + (list(roles)[0] || 'software engineer'),
      needSponsorship: form().querySelector('[name=needSponsorship]:checked').value,
      sponsorship: val('sponsorship') || "I'll need visa sponsorship.",
      roles, locations: val('locations'), watchlist: '', skip: '',
      dailyLimit: (window.JD_CONFIG || {}).DAILY_LIMIT || 10, morning: '7:45 AM', evening: '5:45 PM', tz: ctx.tz,
    };
    const file = form().elements.resumeFile.files[0], text = '';

    show(2); $('su-progress').hidden = false; $('su-done').hidden = true;
    const prog = $('su-prog'); prog.replaceChildren();
    const task = async (label, key, fn) => {
      const li = document.createElement('li'); const sp = document.createElement('span'); sp.className = 'spinner';
      li.append(sp, document.createTextNode(label)); prog.append(li);
      try {
        if (!(key in created)) created[key] = await fn();
        li.className = 'ok'; sp.replaceWith(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), { innerHTML: '<use href="#i-check"/>' }));
        li.querySelector('svg').setAttribute('class', 'ic sm');
      } catch (e) { li.className = 'fail'; sp.remove(); throw e; }
    };
    try {
      // A setup that stopped halfway leaves its folders behind; reuse them instead of making duplicates.
      if (!('folder' in created)) {
        const prev = await api(DRIVE + '?' + new URLSearchParams({ q: "appProperties has { key='jobAgentRole' and value='root' } and trashed = false", orderBy: 'createdTime desc', pageSize: '1', fields: 'files(id)' }));
        const root = (prev.files || [])[0];
        if (root) {
          created.folder = root.id;
          const kids = await api(DRIVE + '?' + new URLSearchParams({ q: `'${root.id}' in parents and trashed = false`, fields: 'files(id,appProperties)' }));
          const byRole = Object.fromEntries((kids.files || []).map((f) => [(f.appProperties || {}).jobAgentRole, f.id]));
          if (byRole.resumes && byRole.outreach && byRole.runlogs) created.subs = { resumes: byRole.resumes, outreach: byRole.outreach, runlogs: byRole.runlogs };
        }
      }
      await task('Creating the Job Agent folder', 'folder', async () => (await mkFolder('Job Agent', null, 'root')).id);
      await task('Creating folders for resumes, outreach and run logs', 'subs', async () => {
        const [r, o, l] = await Promise.all([mkFolder('Tailored Resumes', created.folder, 'resumes'), mkFolder('Referral Outreach Drafts', created.folder, 'outreach'), mkFolder('Run Logs', created.folder, 'runlogs')]);
        return { resumes: r.id, outreach: o.id, runlogs: l.id };
      });
      await task('Creating your job tracker sheet', 'tracker', async () => {
        const f = await api(DRIVE + '?fields=id', { json: { name: 'Job Application Tracker', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [created.folder] } });
        const meta = await api(SHEETS + f.id + '?fields=sheets.properties.sheetId');
        const first = meta.sheets[0].properties.sheetId;
        const ids = { Jobs: first, ...SHEET_IDS };
        await api(SHEETS + f.id + ':batchUpdate', { json: { requests: [
          { updateSheetProperties: { properties: { sheetId: first, title: 'Jobs', gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } },
          ...Object.entries(SHEET_IDS).map(([title, sheetId]) => ({ addSheet: { properties: { sheetId, title, gridProperties: { frozenRowCount: 1 } } } })),
        ] } });
        await api(SHEETS + f.id + '/values:batchUpdate', { json: { valueInputOption: 'RAW', data: [
          { range: "'Jobs'!A1", values: [HEADERS.Jobs] },
          { range: "'Outreach'!A1", values: [HEADERS.Outreach] },
          { range: "'Runs'!A1", values: [HEADERS.Runs] },
          { range: "'Profile'!A1", values: profileRows(a) },
        ] } });
        await api(SHEETS + f.id + ':batchUpdate', { json: { requests: [
          ...Object.values(ids).map((sheetId) => ({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } })),
          { setDataValidation: { range: { sheetId: first, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 13, endColumnIndex: 14 },
            rule: { condition: { type: 'ONE_OF_LIST', values: STATUSES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false } } },
          { updateDimensionProperties: { range: { sheetId: SHEET_IDS.Profile, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 160 }, fields: 'pixelSize' } },
          { updateDimensionProperties: { range: { sheetId: SHEET_IDS.Profile, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 460 }, fields: 'pixelSize' } },
        ] } });
        return f.id;
      });
      await task('Writing your search config', 'config', async () => (await upload({ name: 'SEARCH CONFIG (edit me)', mimeType: DOC, parents: [created.folder] }, new Blob([configHtml(a)], { type: 'text/html' }), 'text/html')).id);
      await task(file ? 'Uploading your resume' : 'Creating your base resume', 'resume', async () => {
        const meta = { name: `BASE RESUME - ${a.fullName}`, mimeType: DOC, parents: [created.folder] };
        if (file) {
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          return (await upload(meta, file, file.type || MIME[ext] || 'application/octet-stream')).id;
        }
        const body = text ? `<html><body>${text.split(/\n/).map((l) => `<p>${esc(l)}</p>`).join('')}</body></html>`
          : `<html><body><h1>${esc(a.fullName)}</h1><p>[Paste your resume here. The agents tailor a copy of this doc for every job.]</p></body></html>`;
        return (await upload(meta, new Blob([body], { type: 'text/html' }), 'text/html')).id;
      });
      await task('Connecting everything to this dashboard', 'link', async () => {
        await api(`${DRIVE}/${created.tracker}?fields=id`, { method: 'PATCH', json: { appProperties: {
          jobAgentRole: 'tracker', folder: created.folder, config: created.config, resume: created.resume,
          resumes: created.subs.resumes, outreach: created.subs.outreach, runlogs: created.subs.runlogs, profileGid: String(SHEET_IDS.Profile),
        } } });
        return true;
      });
    } catch (e) {
      $('su-err').textContent = /confirm access/.test(e.message) ? e.message + '.' : 'Something went wrong: ' + e.message.slice(0, 160) + '. Click Try again; finished steps won’t be repeated.';
      $('su-nav').hidden = false; $('su-next').textContent = 'Try again'; $('su-back').style.visibility = 'hidden';
      retry = true;
      return;
    }
    created.done = true;
    created.ws = { tracker: created.tracker, folder: created.folder, config: created.config, resume: created.resume, resumes: created.subs.resumes, outreach: created.subs.outreach, runlogs: created.subs.runlogs, profileGid: String(SHEET_IDS.Profile) };
    created.who = { fullName: a.fullName, firstName: a.firstName, tz: a.tz, morning: a.morning, evening: a.evening };
    $('su-progress').hidden = true; $('su-done').hidden = false; $('su-nav').hidden = true;
    document.querySelectorAll('.su-times').forEach((s) => { s.textContent = `${a.morning} and ${a.evening}`; });
    document.querySelectorAll('#su-steps li').forEach((li) => { li.classList.remove('on'); li.classList.add('done'); });
  }

  // ---------- Connect a tracker this site didn't create (Google Picker grants access to just that file) ----------
  function loadPicker() {
    if (window.google && google.picker) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('could not load the Google file picker')) });
      if (window.gapi) return done();
      const sc = document.createElement('script'); sc.src = 'https://apis.google.com/js/api.js';
      sc.onload = done; sc.onerror = () => reject(new Error('could not load the Google file picker'));
      document.head.append(sc);
    });
  }
  async function connectExisting() {
    const note = $('su-connect-note');
    const key = (window.JD_CONFIG || {}).GOOGLE_API_KEY;
    if (!key) { note.textContent = 'Connecting an existing tracker isn\u2019t turned on for this site yet (the site owner needs to add a Google API key). You can still choose "I\u2019m new".'; return; }
    note.textContent = 'Opening your Google Drive…';
    try {
      await loadPicker();
      const token = await ctx.getToken();
      const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST).setQuery('Job Application Tracker');
      new google.picker.PickerBuilder()
        .addView(view).setOAuthToken(token).setDeveloperKey(key)
        .setAppId(String(window.JD_CONFIG.GOOGLE_CLIENT_ID).split('-')[0])
        .setTitle('Pick your Job Application Tracker')
        .setCallback((d) => {
          if (d.action === google.picker.Action.PICKED) attach(d.docs[0].id).catch((e) => { note.textContent = 'Could not connect that sheet: ' + e.message.slice(0, 160); });
          else if (d.action === google.picker.Action.CANCEL) note.textContent = '';
        })
        .build().setVisible(true);
    } catch (e) { note.textContent = 'Could not open the file picker: ' + e.message.slice(0, 160); }
  }
  async function attach(id) {
    const note = $('su-connect-note');
    note.textContent = 'Connecting your tracker…';
    const meta = await api(SHEETS + id + '?fields=sheets.properties(sheetId,title)');
    const tabs = meta.sheets.map((x) => x.properties);
    const has = (t) => tabs.find((x) => x.title.toLowerCase() === t.toLowerCase());
    const jobsTab = (has('Jobs') || tabs[0]).title;
    const missing = ['Outreach', 'Runs', 'Profile'].filter((t) => !has(t));
    if (missing.length) {
      await api(SHEETS + id + ':batchUpdate', { json: { requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) } });
      const blankProfile = [HEADERS.Profile, ...['First name', 'Full name', 'Pitch', 'Work authorization', 'Schools', 'Past employers', 'Skills', 'Highlight', 'Morning run', 'Evening run', 'Time zone', 'Daily job limit', 'InMails per day'].map((f) => [f, f === 'Time zone' ? ctx.tz : ''])];
      await api(SHEETS + id + '/values:batchUpdate', { json: { valueInputOption: 'RAW', data: missing.map((t) => ({ range: `'${t}'!A1`, values: t === 'Profile' ? blankProfile : [HEADERS[t]] })) } });
    }
    const after = missing.includes('Profile') ? await api(SHEETS + id + '?fields=sheets.properties(sheetId,title)') : meta;
    const prof = after.sheets.map((x) => x.properties).find((x) => x.title.toLowerCase() === 'profile');
    const file = await api(`${DRIVE}/${id}?fields=parents`);
    const folder = (file.parents || [])[0] || '';
    const props = { jobAgentRole: 'tracker', jobsTab, profileGid: String(prof ? prof.sheetId : '') };
    if (folder) props.folder = folder;
    await api(`${DRIVE}/${id}?fields=id`, { method: 'PATCH', json: { appProperties: props } });
    note.textContent = '';
    $('setup').hidden = true;
    ctx.onDone({ tracker: id, folder, jobsTab, profileGid: props.profileGid });
  }

  // ---------- Agent instructions (filled with this user's IDs) ----------
  async function agentPrompt(ws, who) {
    const r = await fetch('agent/agent-prompt.md', { cache: 'no-store' });
    if (!r.ok) throw new Error('could not load the agent template');
    let t = (await r.text()).replace(/^<!--[\s\S]*?-->\s*/, '');
    const map = {
      '<YOUR FULL NAME>': who.fullName || who.firstName || 'the user', '<YOUR FIRST NAME>': who.firstName || 'the user', '<TIME ZONE>': who.tz || 'America/Los_Angeles',
      '<JOB AGENT FOLDER ID>': ws.folder, '<SEARCH CONFIG DOC ID>': ws.config, '<BASE RESUME DOC ID>': ws.resume, '<TRACKER SHEET ID>': ws.tracker,
      '<TAILORED RESUMES FOLDER ID>': ws.resumes, '<OUTREACH DRAFTS FOLDER ID>': ws.outreach, '<RUN LOGS FOLDER ID>': ws.runlogs,
    };
    for (const [k, v] of Object.entries(map)) t = t.split(k).join(v || k);
    return t;
  }
  async function copyPrompt(buttonEl, ws, who) {
    const label = buttonEl.lastChild.textContent;
    try {
      await navigator.clipboard.writeText(await agentPrompt(ws, who));
      buttonEl.lastChild.textContent = 'Copied! Now paste it into Claude';
    } catch (e) { buttonEl.lastChild.textContent = 'Could not copy: ' + e.message; }
    setTimeout(() => { buttonEl.lastChild.textContent = label; }, 3500);
  }

  // ---------- Wiring ----------
  let wired = false;
  function wire() {
    if (wired) return; wired = true;
    form().addEventListener('submit', (e) => {
      e.preventDefault();
      if (retry || validate(1)) { retry = false; create(); }
    });
    $('su-back').addEventListener('click', () => { if (step >= 1) show(step - 1); });
    $('su-new').addEventListener('click', () => show(1));
    $('su-connect').addEventListener('click', connectExisting);
    // "Where" multi-select: keep the hidden field and the summary text in sync.
    const syncWhere = () => {
      const picked = [...$('su-where').querySelectorAll('.ms-opt input:checked')].map((i) => i.value).concat(list($('su-where-other').value));
      form().elements.locations.value = picked.join(', ');
      $('su-where-text').textContent = picked.length ? picked.join(', ') : 'Choose places';
    };
    $('su-where').addEventListener('change', syncWhere);
    $('su-where-other').addEventListener('input', syncWhere);
    document.addEventListener('click', (e) => { if ($('su-where').open && !$('su-where').contains(e.target)) $('su-where').open = false; });
    $('su-switch').addEventListener('click', () => { $('setup').hidden = true; ctx.onSwitchAccount(); });
    form().querySelectorAll('[name=needSponsorship]').forEach((r) => r.addEventListener('change', () => {
      form().querySelector('.su-spons').hidden = form().querySelector('[name=needSponsorship]:checked').value !== 'yes';
    }));
    form().elements.resumeFile.addEventListener('change', () => {
      const f = form().elements.resumeFile.files[0];
      $('su-file-name').textContent = f ? f.name : 'Add your resume';
      $('su-drop').classList.toggle('has', !!f);
    });
    $('su-copy').addEventListener('click', () => copyPrompt($('su-copy'), created.ws, created.who));
    $('su-open').addEventListener('click', () => { $('setup').hidden = true; ctx.onDone(created.ws); });
  }

  function open(c) {
    ctx = c; created = {};
    wire();
    $('setup').hidden = false;
    retry = false;
    $('su-progress').hidden = true; $('su-done').hidden = true;
    $('su-connect-note').textContent = '';
    // Prefill from the Google account so most people only add a resume.
    $('su-who').textContent = 'your Google account';
    api('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)').then((res) => {
      const u = res.user || {};
      if (u.emailAddress) $('su-who').textContent = u.emailAddress;
      const f = form().elements;
      if (u.displayName && !f.fullName.value) f.fullName.value = u.displayName;
      if (u.displayName && !f.firstName.value) f.firstName.value = u.displayName.split(/\s+/)[0];
    }).catch(() => { /* prefill is a nicety */ });
    // Without a Picker API key there's nothing to choose: go straight to the setup questions.
    show((window.JD_CONFIG || {}).GOOGLE_API_KEY ? 0 : 1);
  }

  return { open, agentPrompt, copyPrompt };
})();
