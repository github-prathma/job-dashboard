// LinkedIn outreach drafting. Edit the facts and wording here; every
// message is built only from these lines, so keep them true.
window.JD_OUTREACH = (() => {
  const NOTE_LIMIT = 300; // LinkedIn connection note limit
  const ME = {
    name: 'Prathma',
    pitch: 'a Sr. Software Engineer with 7+ years in fintech (Intuit, PayPal, Visa)',
    shortPitch: 'fintech engineer (Intuit, PayPal, Visa)',
    // Work authorization, used only in messages to recruiters.
    sponsorship: "I'm currently pursuing an executive doctorate, which authorizes me to work full-time through Curricular Practical Training (CPT) for up to four years. Would your team be able to support CPT authorization for this role? I would also need H-1B sponsorship.",
    shortSponsorship: "I'm on CPT through my doctoral program and would need H-1B sponsorship.",
  };

  // Highlights from the resume, matched to a role by keywords.
  // long: used in InMails. short: used in connection notes.
  const HIGHLIGHTS = [
    { keys: ['ai', 'ml', 'llm', 'llms', 'genai', 'machine learning', 'rag', 'agent', 'agents', 'langchain', 'embeddings'],
      long: 'built a GenAI RAG engine at Visa (LangChain, OpenAI embeddings) that automated review of long contract documents',
      short: 'built a GenAI RAG engine at Visa', area: 'AI applications' },
    { keys: ['payment', 'payments', 'checkout', 'merchant', 'merchants', 'commerce', 'billing', 'fintech', 'money', 'card', 'cards', 'payouts', 'ledger'],
      long: 'built payment and compliance flows at Visa and PayPal, including Shopify merchant onboarding and payouts',
      short: 'built payments systems at Visa and PayPal', area: 'payments' },
    { keys: ['payroll', 'hr', 'workforce', 'benefits', 'compliance', 'verification', 'kyc', 'risk'],
      long: 'work on payroll-critical systems at Intuit and shipped compliance verification fixes for Shopify merchants at PayPal',
      short: 'work on payroll systems at Intuit', area: 'payroll and compliance' },
    { keys: ['platform', 'infrastructure', 'infra', 'data', 'streaming', 'kafka', 'distributed', 'reliability', 'observability', 'sre', 'event driven', 'pipeline', 'pipelines', 'scalability'],
      long: 'am leading a move to event-driven Kafka at Intuit that cut data latency from 40 to 50 minutes down to near real-time',
      short: 'cut pipeline latency to near real-time at Intuit', area: 'platform and data infrastructure' },
    { keys: ['api', 'apis', 'graphql', 'integration', 'integrations', 'developer'],
      long: "led Visa's move from REST to GraphQL, which other teams across Visa then adopted",
      short: 'led a REST-to-GraphQL move at Visa', area: 'APIs' },
    { keys: ['frontend', 'front end', 'full stack', 'fullstack', 'full-stack', 'react', 'angular', 'web', 'ui', 'typescript'],
      long: 'built full-stack Angular and Spring Boot apps at Visa used across 5 internal platforms, improving analyst workflows by 25%',
      short: 'build full-stack apps (React, Angular, Spring Boot)', area: 'full-stack engineering' },
    { keys: ['backend', 'back end', 'microservice', 'microservices', 'java', 'spring', 'services', 'server', 'mongodb'],
      long: 're-architected legacy services into Spring Boot microservices at Visa, improving response times by 35% under load',
      short: 'scaled Java microservices at Visa', area: 'backend systems' },
  ];
  const DEFAULT = HIGHLIGHTS[1];

  // Skills on the resume. Only these are ever named as a match with a posting.
  const SKILLS = [
    ['Java', /\bjava\b(?!\s*script)/i], ['Spring Boot', /\bspring\b/i], ['Python', /\bpython\b/i], ['TypeScript', /\btypescript\b/i],
    ['JavaScript', /\bjavascript\b/i], ['React', /\breact\b/i], ['Angular', /\bangular\b/i], ['Node.js', /\bnode(\.js)?\b/i],
    ['GraphQL', /\bgraphql\b/i], ['REST APIs', /\brest(ful)?\b/i], ['Kafka', /\bkafka\b/i], ['microservices', /\bmicro-?services?\b/i],
    ['distributed systems', /\bdistributed (systems?|computing)\b/i], ['event-driven systems', /\bevent[- ]driven\b/i],
    ['MongoDB', /\bmongo(db)?\b/i], ['PostgreSQL', /\bpostgres(ql)?\b/i], ['MySQL', /\bmysql\b/i], ['AWS', /\baws\b|amazon web services/i],
    ['GCP', /\bgcp\b|google cloud/i], ['Docker', /\bdocker\b/i], ['CI/CD', /\bci\/?cd\b|continuous (integration|delivery)/i],
    ['observability', /\bobservability\b/i], ['OpenTelemetry', /\bopentelemetry\b/i], ['Datadog', /\bdatadog\b/i], ['LLMs', /\bllms?\b|large language models?/i],
    ['RAG', /\brag\b|retrieval[- ]augmented/i], ['GenAI', /\bgen(erative)? ?ai\b/i], ['payments', /\bpayments?\b/i],
    ['compliance', /\bcompliance\b/i], ['payroll', /\bpayroll\b/i], ['fintech', /\bfintech\b|financial services/i],
    ['test automation', /\b(test|testing) automation\b|\bplaywright\b|\bjunit\b/i], ['FastAPI', /\bfastapi\b/i],
  ];

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
    return best || DEFAULT;
  }

  const fit = (opts) => opts.filter(Boolean).find((s) => s.length <= NOTE_LIMIT) || opts.filter(Boolean).reduce((a, b) => (b.length < a.length ? b : a));

  // ---------- Connection notes ----------
  function notes(f, h, sk) {
    const n = first(f.name), r = shortRole(f.role), c = f.company;
    const fx = sk.length >= 2 ? list(sk.slice(0, 3)) : sk[0] || '';
    const fx2 = sk.length >= 2 ? list(sk.slice(0, 2)) : sk[0] || '';
    const rel = fx ? ` Its focus on ${fx} matches my background.` : '';
    const rel2 = fx2 ? ` Its focus on ${fx2} matches my work.` : '';
    const by = {
      recruiter: [
        [`Hi ${n}, I'm interested in the ${r} role at ${c}.${rel} I'm a ${ME.shortPitch} and ${h.short}. ${ME.shortSponsorship} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${rel2} I ${h.short}. ${ME.shortSponsorship} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}. I'm a ${ME.shortPitch}. ${ME.shortSponsorship} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}. ${ME.shortSponsorship} Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${rel} I'm a ${ME.shortPitch} and ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}.${rel2} I ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}. I'm a ${ME.shortPitch} and ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in ${r} at ${c} and would love to connect!`],
        [`Hi ${n}, I'm applying for ${r} at ${c}.${rel} I'm a ${ME.shortPitch}. ${ME.shortSponsorship} Would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c}. I'm a ${ME.shortPitch}. ${ME.shortSponsorship} Would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c}. ${ME.shortSponsorship} Would love to connect!`,
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
    const sign = `\n\nThanks,\n${ME.name}`;
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
          body: `Hi ${n},\n\nI'm ${ME.pitch}, and I just applied for the ${r} role${team} at ${c}${link}.${rel} A recent highlight: I ${h.long}.\n\n${ME.sponsorship}\n\nWould you be the right person to talk to about this role?${sign}` },
        { subject: `Interested in ${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI came across the ${r} opening${team} at ${c}${link} and it lines up closely with my background in ${h.area}.${rel} For example, I ${h.long}.\n\n${ME.sponsorship}\n\n${asks.consider}${sign}` },
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

  function draft(f, posting) {
    const text = [posting && posting.text, f.jd].filter(Boolean).join('\n');
    const sk = matchedSkills(text);
    const h = pick(f.role, f.company, text);
    return { highlight: h, skills: sk, variants: f.type === 'note' ? notes(f, h, sk) : inmails(f, h, sk, posting) };
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

  return { draft, readPosting, matchedSkills, LIMITS: { note: NOTE_LIMIT, subject: 200, inmail: 1900 } };
})();
