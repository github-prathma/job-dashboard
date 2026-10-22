// LinkedIn outreach drafting. Edit the facts and wording here; every
// message is built only from these lines, so keep them true.
window.JD_OUTREACH = (() => {
  const NOTE_LIMIT = 300; // LinkedIn connection note limit
  // Everything personal comes from the Profile tab of the user's tracker (see setProfile).
  // Until it loads, messages use neutral wording and never claim a specific skill.
  const ME = { name: '', pitch: 'a software engineer', shortPitch: 'software engineer', sponsorship: '', shortSponsorship: '' };

  // Highlights from the resume, matched to a role by keywords.
  // long: used in InMails ("I <long>"). short: used in connection notes ("I <short>"). area: "my background in <area>".
  let HIGHLIGHTS = [];
  const FALLBACK = { keys: [], long: 'have shipped production systems end to end', short: 'ship production systems end to end', area: 'software engineering' };

  // Skills on the resume (Profile tab, "Skills" row). Only these are ever named as a match with a posting.
  // Some names need a smarter pattern than a plain word match.
  const ALIASES = {
    'java': /\bjava\b(?!\s*script)/i, 'spring boot': /\bspring\b/i, 'node.js': /\bnode(\.js)?\b/i, 'rest apis': /\brest(ful)?\b/i,
    'microservices': /\bmicro-?services?\b/i, 'distributed systems': /\bdistributed (systems?|computing)\b/i, 'event-driven systems': /\bevent[- ]driven\b/i,
    'mongodb': /\bmongo(db)?\b/i, 'postgresql': /\bpostgres(ql)?\b/i, 'aws': /\baws\b|amazon web services/i, 'gcp': /\bgcp\b|google cloud/i,
    'ci/cd': /\bci\/?cd\b|continuous (integration|delivery)/i, 'llms': /\bllms?\b|large language models?/i, 'rag': /\brag\b|retrieval[- ]augmented/i,
    'genai': /\bgen(erative)? ?ai\b/i, 'payments': /\bpayments?\b/i, 'fintech': /\bfintech\b|financial services/i,
    'test automation': /\b(test|testing) automation\b|\bplaywright\b|\bjunit\b/i, 'kubernetes': /\bkubernetes\b|\bk8s\b/i, 'c++': /(^|[^a-z])c\+\+/i,
  };
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const skillRe = (name) => ALIASES[name.toLowerCase()] || new RegExp('(^|[^a-z0-9])' + escRe(name) + '(?![a-z0-9])', 'i');
  let SKILLS = [];

  const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
  const shortRole = (role) => String(role || 'this role').replace(/\s*[,(\-–|].*$/, '').trim() || role;
  const norm = (s) => ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

  function matchedSkills(text) {
    if (!text) return [];
    const hits = [];
    for (const [label, re] of SKILLS) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      const n = (String(text).match(g) || []).length;
      if (n) hits.push({ label, n });
    }
    return hits.sort((a, b) => b.n - a.n).map((h) => h.label);
  }

  // Role title counts 3x; the posting text adds weight by how often each theme appears.
  function pick(role, company, text) {
    const t = norm(role + ' ' + company), d = norm(text);
    let best = null, score = 0;
    for (const h of HIGHLIGHTS) {
      let s = 0;
      for (const k of h.keys) {
        if (t.includes(' ' + k + ' ')) s += 3;
        if (d.length > 2) s += Math.min(3, d.split(' ' + k + ' ').length - 1);
      }
      if (s > score) { best = h; score = s; }
    }
    return best || HIGHLIGHTS[0] || FALLBACK;
  }

  const fit = (opts) => opts.filter(Boolean).find((s) => s.length <= NOTE_LIMIT) || opts.filter(Boolean).reduce((a, b) => (b.length < a.length ? b : a));

  // ---------- Connection notes ----------
  function notes(f, h, sk) {
    const n = first(f.name), r = shortRole(f.role), c = f.company;
    const ss = ME.shortSponsorship ? ' ' + ME.shortSponsorship : '';
    const fx = sk.length >= 2 ? list(sk.slice(0, 3)) : sk[0] || '';
    const fx2 = sk.length >= 2 ? list(sk.slice(0, 2)) : sk[0] || '';
    const rel = fx ? ` Its focus on ${fx} matches my background.` : '';
    const rel2 = fx2 ? ` Its focus on ${fx2} matches my work.` : '';
    const by = {
      recruiter: [
        [`Hi ${n}, I'm interested in the ${r} role at ${c}.${rel} I'm a ${ME.shortPitch} and ${h.short}.${ss} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${rel2} I ${h.short}.${ss} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}. I'm a ${ME.shortPitch}.${ss} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${ss} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${rel} I'm a ${ME.shortPitch} and ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${rel2} I ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}. I'm a ${ME.shortPitch} and ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in ${r} at ${c} and would love to connect!`],
        [`Hi ${n}, I'm applying for ${r} at ${c}.${rel} I'm a ${ME.shortPitch}.${ss} Would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c}. I'm a ${ME.shortPitch}.${ss} Would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c}.${ss} Would love to connect!`,
         `Hi ${n}, I'm applying for ${r} at ${c}.${rel} I'm a ${ME.shortPitch} and would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect. I'm a ${ME.shortPitch}.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect!`],
      ],
      manager: [
        [`Hi ${n}, I saw the ${r} opening on your team at ${c}.${rel} I ${h.short} and would love to connect and learn what you're building.`,
         `Hi ${n}, I saw the ${r} opening at ${c}.${rel2} I ${h.short} and would love to connect.`,
         `Hi ${n}, I saw the ${r} opening at ${c}. I ${h.short} and would love to connect and learn what you're building.`,
         `Hi ${n}, I saw the ${r} opening at ${c} and would love to connect!`],
        [`Hi ${n}, I'm applying for ${r} at ${c}. I'm a ${ME.shortPitch}${fx2 ? `, and the role's focus on ${fx2} is right in my wheelhouse` : ''}. Would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c}. I'm a ${ME.shortPitch} and would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect!`],
      ],
      engineer: [
        [`Hi ${n}, I'm applying for ${r} at ${c} and would love to hear what it's like on the team.${rel} I'm a ${ME.shortPitch}. Happy to connect!`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to hear what the team is like. I'm a ${ME.shortPitch}. Happy to connect!`,
         `Hi ${n}, I'm applying for ${r} at ${c}. Would love to connect!`],
        [`Hi ${n}, I'm a ${ME.shortPitch} looking at ${r} at ${c}. I ${h.short}${fx2 ? `, so the role's ${fx2} work caught my eye` : ''}. Would love to connect and learn about your work.`,
         `Hi ${n}, I'm a ${ME.shortPitch} looking at ${r} at ${c}. Would love to connect and learn about your work.`,
         `Hi ${n}, I'm looking at ${r} at ${c}. Would love to connect!`],
      ],
      connection: [
        [`Hi ${n}, hope you're doing well! I'm applying for ${r} at ${c}.${rel} I ${h.short}. Would love to reconnect and hear how it's going there.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect. I ${h.short}.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect!`],
        [`Hi ${n}, I'm a ${ME.shortPitch} interested in ${r} at ${c}.${rel2} Would love to connect!`,
         `Hi ${n}, I'm a ${ME.shortPitch} interested in ${r} at ${c}. Would love to connect!`,
         `Hi ${n}, I'm interested in ${r} at ${c}. Would love to connect!`],
      ],
    };
    return (by[f.recipient] || by.connection).map((opts) => ({ subject: '', body: fit(opts) }));
  }

  // ---------- InMails ----------
  function inmails(f, h, sk, posting) {
    const n = first(f.name), r = f.role, c = f.company, link = f.link ? ` (${f.link})` : '';
    const sign = ME.name ? `\n\nThanks,\n${ME.name}` : '\n\nThanks!';
    const spPara = ME.sponsorship ? `\n\n${ME.sponsorship}\n\n` : '\n\n';
    const team = posting && posting.team ? ` on the ${posting.team} team` : '';
    const rel = sk.length >= 2 ? ` The posting's focus on ${list(sk.slice(0, 3))} matches what I've been doing day to day.`
      : sk.length === 1 ? ` The role's emphasis on ${sk[0]} lines up closely with my background.` : '';
    const asks = {
      referral: 'Would you be open to referring me, or pointing me to the right person? I can send my resume and a short summary to make it easy.',
      chat: 'Would you be open to a 15-minute chat about the team and the role?',
      consider: "I'd appreciate it if you could take a look at my application or let me know who's hiring for it.",
    };
    const ask = asks[f.goal] || asks.referral;
    const sets = {
      recruiter: [
        { subject: `${r} at ${c}`,
          body: `Hi ${n},\n\nI'm ${ME.pitch}, and I just applied for the ${r} role${team} at ${c}${link}.${rel} A recent highlight: I ${h.long}.${spPara}Would you be the right person to talk to about this role?${sign}` },
        { subject: `Interested in ${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI came across the ${r} opening${team} at ${c}${link} and it lines up closely with my background in ${h.area}.${rel} For example, I ${h.long}.${spPara}${asks.consider}${sign}` },
      ],
      manager: [
        { subject: `${shortRole(r)} on your team`,
          body: `Hi ${n},\n\nI saw the ${r} opening${team} at ${c}${link}. I'm ${ME.pitch}, and I ${h.long}.${rel}\n\nI'd love to learn what the team is building and whether my experience in ${h.area} could help. ${f.goal === 'referral' ? asks.chat : ask}${sign}` },
        { subject: `${h.area[0].toUpperCase() + h.area.slice(1)} experience for ${c}`,
          body: `Hi ${n},\n\nI'm applying for ${r}${team} at ${c}${link}.${rel} I ${h.long}, and I'm looking for a team where I can keep doing that kind of work at scale.\n\n${ask}${sign}` },
      ],
      engineer: [
        { subject: `Question about ${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI'm ${ME.pitch} and I'm applying for ${r}${team} at ${c}${link}. I ${h.long}.${rel}\n\nSince you're on the team, I'd value your honest take on what the work is like. ${ask}${sign}` },
        { subject: `Referral for ${shortRole(r)}?`,
          body: `Hi ${n},\n\nI noticed ${c} is hiring a ${r}${team}${link}. My background in ${h.area} fits it well: I ${h.long}.${rel}\n\n${ask}${sign}` },
      ],
      connection: [
        { subject: `Referral for ${shortRole(r)} at ${c}?`,
          body: `Hi ${n},\n\nHope you're doing well! I noticed ${c} is hiring a ${r}${team}${link}. My background in ${h.area} lines up closely: I ${h.long}.${rel}\n\n${ask}${sign}` },
        { subject: `${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI'm applying for ${r}${team} at ${c}${link} and thought of you.${rel} I ${h.long}.\n\n${ask}${sign}` },
      ],
    };
    return sets[f.recipient] || sets.connection;
  }

  // ---------- Intro asks (to a 1st-degree connection who knows someone at the company) ----------
  function intros(f, h, sk, posting) {
    const n = first(f.name), r = f.role, c = f.company, link = f.link ? ` (${f.link})` : '';
    const who = f.target ? f.target : `someone on the team at ${c}`;
    const team = posting && posting.team ? ` on the ${posting.team} team` : '';
    const rel = sk.length >= 2 ? ` The role focuses on ${list(sk.slice(0, 3))}, which is what I've been doing day to day.` : '';
    const sign = ME.name ? `\n\nThanks so much,\n${ME.name}` : '\n\nThanks so much!';
    return [
      { subject: '', body: `Hi ${n},\n\nHope you're doing well! I'm applying for the ${r} role${team} at ${c}${link}, and I noticed you're connected with ${who}.${rel} I ${h.long}.\n\nWould you be comfortable introducing me? I'm happy to send a short blurb and my resume so it's easy to forward, and no worries at all if you don't know them well.${sign}` },
      { subject: '', body: `Hi ${n},\n\nQuick favor to ask: I'm interested in ${r} at ${c}${link}, and I see you know ${who}. My background in ${h.area} fits the role well (I ${h.long}).\n\nWould you be open to making a quick intro? I can draft a short note you could forward.${sign}` },
    ];
  }

  function draft(f, posting) {
    const text = [posting && posting.text, f.jd].filter(Boolean).join('\n');
    const sk = matchedSkills(text);
    const h = pick(f.role, f.company, text);
    let variants;
    if (f.recipient === 'intro') variants = intros(f, h, sk, posting);
    else if (f.type === 'note') variants = notes(f, h, sk);
    else variants = inmails(f, h, sk, posting);
    // A regular LinkedIn message to someone you're connected to has no subject line.
    if (f.type === 'message') variants = variants.map((v) => ({ subject: '', body: v.body }));
    return { highlight: h, skills: sk, variants };
  }

  // ---------- LinkedIn people searches (opened in your own signed-in browser) ----------
  // From the Profile tab: schools and past employers (not your current one).
  let SCHOOLS = [], PAST_EMPLOYERS = [];
  const quote = (t) => (/\s/.test(t) ? `"${t}"` : t);
  function peopleSearch(company, kind) {
    const base = 'https://www.linkedin.com/search/results/people/?';
    const c = String(company || '').trim();
    // company= is LinkedIn's "Company" keyword filter (All filters > Keywords > Company). It matches
    // the person's current company, unlike plain keywords, which also match "Ex-Stripe" headlines.
    const params = { origin: 'FACETED_SEARCH', geoUrn: '["103644278"]', company: c };
    // geoUrn 103644278 is LinkedIn's filter for people located in the United States.
    if (kind === 'first') params.network = '["F"]';
    else if (kind === 'second') params.network = '["S"]';
    else if (kind === 'alumni' && SCHOOLS.length) params.keywords = SCHOOLS.map(quote).join(' OR ');
    else if (kind === 'colleagues' && PAST_EMPLOYERS.length) params.keywords = PAST_EMPLOYERS.map(quote).join(' OR ');
    return base + new URLSearchParams(params).toString();
  }
  const orList = (a) => a.join(' or ');
  const searches = () => [
    { kind: 'first', label: 'Your connections', hint: '1st-degree: ask for a referral' },
    { kind: 'second', label: '2nd-degree', hint: 'Ask a mutual connection for an intro' },
    { kind: 'alumni', label: 'Alumni', hint: SCHOOLS.length ? orList(SCHOOLS.slice(0, 2).map((x) => x.replace(/ University$/, ''))) : 'Add your schools in the Profile tab' },
    { kind: 'colleagues', label: 'Ex-colleagues', hint: PAST_EMPLOYERS.length ? 'Also worked at ' + orList(PAST_EMPLOYERS.slice(0, 3)) : 'Add past employers in the Profile tab' },
  ];

  // ---------- Profile (one row per field in the tracker's Profile tab) ----------
  const splitList = (v) => String(v || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  function setProfile(p) {
    p = p || {};
    ME.name = p.firstName || '';
    ME.pitch = p.pitch || 'a software engineer';
    ME.shortPitch = p.shortPitch || ME.pitch.replace(/^an? /i, '');
    ME.sponsorship = p.sponsorship || '';
    ME.shortSponsorship = p.shortSponsorship || p.sponsorship || '';
    SCHOOLS = splitList(p.schools);
    PAST_EMPLOYERS = splitList(p.pastEmployers);
    SKILLS = splitList(p.skills).map((name) => [name, skillRe(name)]);
    HIGHLIGHTS = (p.highlights || []).filter((h) => h && h.long).map((h) => {
      const keys = splitList(h.keywords).map((k) => k.toLowerCase());
      return { keys, long: h.long.replace(/\.$/, ''), short: (h.short || h.long).replace(/\.$/, ''), area: h.area || keys[0] || 'software engineering' };
    });
  }

  // ---------- Reading a job posting from its link ----------
  // Greenhouse, Lever and Ashby publish postings through public APIs a browser can read.
  const htmlToText = (html) => {
    const t = document.createElement('textarea'); t.innerHTML = String(html || ''); // decode escaped HTML
    const doc = new DOMParser().parseFromString(t.value, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  };
  const titleCase = (slug) => String(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function readPosting(rawUrl, companyHint) {
    let u; try { u = new URL(rawUrl); } catch (e) { throw new Error('not_a_link'); }
    const host = u.hostname, parts = u.pathname.split('/').filter(Boolean);
    // Greenhouse: boards.greenhouse.io/<slug>/jobs/<id>, job-boards.greenhouse.io/<slug>/jobs/<id>, or ?gh_jid=<id> on a company site
    let gh = null;
    if (/greenhouse\.io$/.test(host) && parts.length >= 3 && parts[1] === 'jobs') gh = { slug: parts[0], id: parts[2] };
    else if (/greenhouse\.io$/.test(host) && u.searchParams.get('for') && u.searchParams.get('token')) gh = { slug: u.searchParams.get('for'), id: u.searchParams.get('token') };
    else if (u.searchParams.get('gh_jid')) gh = { slug: (companyHint || host.split('.').slice(-2, -1)[0] || '').toLowerCase().replace(/[^a-z0-9]/g, ''), id: u.searchParams.get('gh_jid') };
    if (gh && gh.slug && /^\d+$/.test(gh.id)) {
      const j = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(gh.slug)}/jobs/${gh.id}`);
      const dept = (j.departments && j.departments[0] && j.departments[0].name) || '';
      return { source: 'Greenhouse', title: j.title, company: j.company_name || titleCase(gh.slug), location: j.location && j.location.name, team: dept, text: j.title + ' ' + dept + ' ' + htmlToText(j.content) };
    }
    // Lever: jobs.lever.co/<slug>/<id>
    if (/lever\.co$/.test(host) && parts.length >= 2) {
      const j = await getJSON(`https://api.lever.co/v0/postings/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`);
      const lists = (j.lists || []).map((l) => l.text + ' ' + htmlToText(l.content)).join(' ');
      return { source: 'Lever', title: j.text, company: titleCase(parts[0]), location: j.categories && j.categories.location, team: j.categories && j.categories.team, text: [j.text, j.descriptionPlain, lists, j.additionalPlain].join(' ') };
    }
    // Ashby: jobs.ashbyhq.com/<slug>/<id>
    if (/ashbyhq\.com$/.test(host) && parts.length >= 2) {
      const b = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(parts[0])}`);
      const j = (b.jobs || []).find((x) => x.id === parts[1] || String(x.jobUrl || '').includes(parts[1]));
      if (!j) throw new Error('not_found');
      return { source: 'Ashby', title: j.title, company: titleCase(parts[0]), location: j.location, team: j.team || j.department, text: [j.title, j.department, j.team, j.descriptionPlain].join(' ') };
    }
    throw new Error('unsupported');
  }

  return { draft, readPosting, matchedSkills, peopleSearch, setProfile, get SEARCHES() { return searches(); }, LIMITS: { note: NOTE_LIMIT, subject: 200, inmail: 1900, message: 8000 } };
})();
