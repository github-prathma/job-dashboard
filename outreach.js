// LinkedIn outreach drafting. Edit the facts and wording here; every
// message is built only from these lines, so keep them true.
window.JD_OUTREACH = (() => {
  const ME = {
    name: 'Prathma',
    pitch: 'a Sr. Software Engineer with 7+ years in fintech (Intuit, PayPal, Visa)',
    shortPitch: 'fintech engineer (Intuit, PayPal, Visa)',
    sponsorship: "I'd need an H-1B transfer.",
  };

  // Highlights from the resume, matched to a role by keywords.
  // long: used in InMails. short: used in 200-character connection notes.
  const HIGHLIGHTS = [
    { keys: ['ai', 'ml', 'llm', 'genai', 'machine learning', 'rag', 'agent'],
      long: 'built a GenAI RAG engine at Visa (LangChain, OpenAI embeddings) that automated review of long contract documents',
      short: 'built a GenAI RAG engine at Visa', area: 'AI applications' },
    { keys: ['payment', 'payments', 'checkout', 'merchant', 'commerce', 'billing', 'fintech', 'money', 'card'],
      long: 'built payment and compliance flows at Visa and PayPal, including Shopify merchant onboarding and payouts',
      short: 'built payments systems at Visa and PayPal', area: 'payments' },
    { keys: ['payroll', 'hr', 'workforce', 'benefits', 'compliance', 'verification'],
      long: 'work on payroll-critical systems at Intuit and shipped compliance verification fixes for Shopify merchants at PayPal',
      short: 'work on payroll systems at Intuit', area: 'payroll and compliance' },
    { keys: ['platform', 'infrastructure', 'infra', 'data', 'streaming', 'kafka', 'distributed', 'reliability', 'observability', 'sre'],
      long: 'am leading a move to event-driven Kafka at Intuit that cut data latency from 40 to 50 minutes down to near real-time',
      short: 'cut pipeline latency to near real-time at Intuit', area: 'platform and data infrastructure' },
    { keys: ['api', 'graphql', 'integration', 'integrations'],
      long: "led Visa's move from REST to GraphQL, which other teams across Visa then adopted",
      short: 'led a REST-to-GraphQL move at Visa', area: 'APIs' },
    { keys: ['frontend', 'front end', 'full stack', 'fullstack', 'full-stack', 'react', 'angular', 'web', 'ui'],
      long: 'built full-stack Angular and Spring Boot apps at Visa used across 5 internal platforms, improving analyst workflows by 25%',
      short: 'build full-stack apps (React, Angular, Spring Boot)', area: 'full-stack engineering' },
    { keys: ['backend', 'back end', 'microservice', 'microservices', 'java', 'spring', 'services', 'server'],
      long: 're-architected legacy services into Spring Boot microservices at Visa, improving response times by 35% under load',
      short: 'scaled Java microservices at Visa', area: 'backend systems' },
  ];
  const DEFAULT = HIGHLIGHTS[1];

  const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
  const shortRole = (role) => String(role || 'this').replace(/\s*[,(\-–|].*$/, '').trim() || role;
  function pick(role, company) {
    const t = ' ' + String(role + ' ' + company).toLowerCase().replace(/[^a-z0-9+ ]/g, ' ') + ' ';
    let best = null, score = 0;
    for (const h of HIGHLIGHTS) {
      const s = h.keys.filter((k) => t.includes(' ' + k + ' ') || t.includes(' ' + k + 's ')).length;
      if (s > score) { best = h; score = s; }
    }
    return best || DEFAULT;
  }

  // ---------- Connection notes (limit 200 characters) ----------
  function notes(f, h) {
    const n = first(f.name), r = shortRole(f.role), c = f.company;
    // Each option lists wordings from fullest to shortest; the first that fits 200 characters wins.
    const byRecipient = {
      recruiter: [
        [`Hi ${n}, I'm interested in the ${r} role at ${c}. I'm a ${ME.shortPitch} and ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in the ${r} role at ${c}. I ${h.short}. Would love to connect!`,
         `Hi ${n}, I'm interested in ${r} at ${c} and would love to connect!`],
        [`Hi ${n}, I'm applying for ${r} at ${c} and would love to connect. I'm a ${ME.shortPitch}.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect!`],
      ],
      manager: [
        [`Hi ${n}, I saw the ${r} opening on your team at ${c}. I ${h.short} and would love to connect and learn what you're building.`,
         `Hi ${n}, I saw the ${r} opening at ${c}. I ${h.short} and would love to connect.`,
         `Hi ${n}, I saw the ${r} opening at ${c} and would love to connect!`],
        [`Hi ${n}, I'm applying for ${r} at ${c}. I'm a ${ME.shortPitch} and would love to connect.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect!`],
      ],
      engineer: [
        [`Hi ${n}, I'm applying for ${r} at ${c} and would love to hear what it's like on the team. I'm a ${ME.shortPitch}. Happy to connect!`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to hear what the team is like. Happy to connect!`,
         `Hi ${n}, I'm applying for ${r} at ${c}. Would love to connect!`],
        [`Hi ${n}, I'm a ${ME.shortPitch} looking at ${r} at ${c}. Would love to connect and learn about your work.`,
         `Hi ${n}, I'm looking at ${r} at ${c}. Would love to connect and learn about your work.`],
      ],
      connection: [
        [`Hi ${n}, I'm applying for ${r} at ${c} and would love to connect. I ${h.short}.`,
         `Hi ${n}, I'm applying for ${r} at ${c} and would love to connect!`],
        [`Hi ${n}, I'm a ${ME.shortPitch} interested in ${r} at ${c}. Would love to connect!`,
         `Hi ${n}, I'm interested in ${r} at ${c}. Would love to connect!`],
      ],
    };
    const fit = (opts) => opts.find((s) => s.length <= 200) || opts.reduce((a, b) => (b.length < a.length ? b : a));
    return (byRecipient[f.recipient] || byRecipient.connection).map((opts) => ({ subject: '', body: fit(opts) }));
  }

  // ---------- InMails ----------
  function inmails(f, h) {
    const n = first(f.name), r = f.role, c = f.company, link = f.link ? ` (${f.link})` : '';
    const sign = `\n\nThanks,\n${ME.name}`;
    const ask = f.goal || 'referral';
    const asks = {
      referral: 'Would you be open to referring me, or pointing me to the right person? I can send my resume and a short summary to make it easy.',
      chat: 'Would you be open to a 15-minute chat about the team and the role?',
      consider: "I'd appreciate it if you could take a look at my application or let me know who's hiring for it.",
    };
    const sets = {
      recruiter: [
        { subject: `${r} at ${c}`,
          body: `Hi ${n},\n\nI'm ${ME.pitch}, and I just applied for the ${r} role at ${c}${link}. A recent highlight: I ${h.long}.\n\n${ME.sponsorship} Would you be the right person to talk to about this role?${sign}` },
        { subject: `Interested in ${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI came across the ${r} opening at ${c}${link} and it lines up closely with my background in ${h.area}. I ${h.long}.\n\n${ME.sponsorship} ${asks.consider}${sign}` },
      ],
      manager: [
        { subject: `${shortRole(r)} on your team`,
          body: `Hi ${n},\n\nI saw the ${r} opening on your team at ${c}${link}. I'm ${ME.pitch}, and I ${h.long}.\n\nI'd love to learn what the team is building and whether my experience in ${h.area} could help. ${asks.chat}${sign}` },
        { subject: `${h.area} experience for ${c}`,
          body: `Hi ${n},\n\nI'm applying for ${r} at ${c}${link}. I ${h.long}, and I'm looking for a team where I can keep doing that kind of work at scale.\n\n${asks[ask] || asks.chat}${sign}` },
      ],
      engineer: [
        { subject: `Question about ${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI'm ${ME.pitch} and I'm applying for ${r} at ${c}${link}. I ${h.long}.\n\nSince you're on the team, I'd value your honest take on what the work is like. ${asks.referral}${sign}` },
        { subject: `Referral for ${shortRole(r)}?`,
          body: `Hi ${n},\n\nI noticed ${c} is hiring a ${r}${link}. My background in ${h.area} fits it well: I ${h.long}.\n\n${asks.referral}${sign}` },
      ],
      connection: [
        { subject: `Referral for ${shortRole(r)} at ${c}?`,
          body: `Hi ${n},\n\nHope you're doing well! I noticed ${c} is hiring a ${r}${link}. My background in ${h.area} lines up closely: I ${h.long}.\n\n${asks.referral}${sign}` },
        { subject: `${shortRole(r)} at ${c}`,
          body: `Hi ${n},\n\nI'm applying for ${r} at ${c}${link} and thought of you. I ${h.long}.\n\n${asks[ask] || asks.referral}${sign}` },
      ],
    };
    return sets[f.recipient] || sets.connection;
  }

  function draft(f) {
    const h = pick(f.role, f.company);
    return { highlight: h, variants: f.type === 'note' ? notes(f, h) : inmails(f, h) };
  }
  return { draft, LIMITS: { note: 200, subject: 200, inmail: 1900 } };
})();
