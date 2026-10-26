// Turns an uploaded resume (PDF or Word .docx) into a cleanly formatted Word file
// that Google Drive converts into the BASE RESUME doc. The layout matches the
// app's one-page style and is sized to fit the same number of pages as the original.
window.JD_RESUME = (() => {
  const LIBS = {
    pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    mammoth: 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
    jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    docx: 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
  };
  const loaded = {};
  const load = (url) => loaded[url] || (loaded[url] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('could not load ' + url.split('/npm/')[1]));
    document.head.append(s);
  }));

  // ---------- 1. Read the file into lines ----------
  const BULLET = /^\s*([\u2022\u25cf\u25aa\u25e6\u2023\u2219\u00b7\u25a0\u25a1\u25ab\u27a2\u27a4\u25ba\u2713\u2714\-*\u2013]|\u2022|\uf0b7|\uf0a7)\s*/;
  const LONE_BULLET = /^\s*([\u2022\u25cf\u25aa\u25e6\u2023\u2219\u00b7\u25a0\u25a1\u25ab\u27a2\u27a4\u25ba\u2713\u2714\-*\u2013]|\u2022|\uf0b7|\uf0a7)\s*$/;

  async function readPdf(buf) {
    await load(LIBS.pdf);
    const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const pdf = await lib.getDocument({ data: buf }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) { if (it.str === ' ' && rows.length) rows[rows.length - 1].space = true; continue; }
        const y = it.transform[5], x = it.transform[4], h = Math.abs(it.transform[3]) || it.height || 10;
        let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, h * 0.35));
        if (!row) { row = { y, h, items: [] }; rows.push(row); }
        row.h = Math.max(row.h, h); row.items.push({ x, w: it.width, s: it.str, h });
      }
      rows.sort((a, b) => b.y - a.y);
      let prevY = null, prevH = null;
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let text = '', end = null;
        for (const it of r.items) {
          if (end !== null) { const gap = it.x - end; text += gap > it.h * 1.5 ? '\t' : gap > it.h * 0.12 ? ' ' : ''; }
          text += it.s; end = it.x + it.w;
        }
        const gap = prevY === null ? 0 : (prevY - r.y) / (prevH || r.h);
        lines.push({ text: text.replace(/[ \u00a0]+/g, ' ').trim(), size: r.h, gapBefore: gap, page: p, x: r.items[0].x });
        prevY = r.y; prevH = r.h;
      }
    }
    return { lines, pages: pdf.numPages };
  }

  async function readDocx(buf) {
    await Promise.all([load(LIBS.mammoth), load(LIBS.jszip)]);
    let pages = 0;
    try {
      const zip = await window.JSZip.loadAsync(buf);
      const app = zip.file('docProps/app.xml');
      if (app) { const m = (await app.async('string')).match(/<Pages>(\d+)<\/Pages>/); if (m) pages = +m[1]; }
    } catch (e) { /* page count is a hint only */ }
    const { value } = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    const doc = new DOMParser().parseFromString('<div>' + value + '</div>', 'text/html');
    const lines = [];
    const walk = (node) => {
      for (const el of node.children) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') { for (const li of el.children) lines.push({ text: li.textContent.trim(), bullet: true, size: 0, gapBefore: 1 }); continue; }
        if (tag === 'table') { for (const tr of el.querySelectorAll('tr')) lines.push({ text: [...tr.children].map((td) => td.textContent.trim()).filter(Boolean).join('\t'), size: 0, gapBefore: 1 }); continue; }
        if (/^(p|h[1-6])$/.test(tag)) {
          const t = el.textContent.replace(/\s+/g, ' ').trim();
          if (t) lines.push({ text: t, size: tag === 'h1' ? 20 : 0, heading: /^h[1-6]$/.test(tag), boldAll: el.children.length && el.textContent.trim() === [...el.querySelectorAll('strong')].map((s) => s.textContent).join('').trim(), gapBefore: 1 });
          continue;
        }
        walk(el);
      }
    };
    walk(doc.body.firstElementChild);
    return { lines, pages };
  }

  // ---------- 2. Work out the structure ----------
  const SECTIONS = ['summary', 'professional summary', 'profile', 'objective', 'about', 'about me', 'experience', 'work experience', 'professional experience',
    'employment', 'employment history', 'work history', 'skills', 'technical skills', 'core competencies', 'key skills', 'education', 'projects', 'personal projects',
    'certifications', 'certificates', 'licenses & certifications', 'awards', 'honors', 'honors & awards', 'accomplishments', 'achievements', 'publications',
    'leadership', 'volunteer', 'volunteering', 'languages', 'interests', 'activities', 'research', 'patents', 'courses', 'training'];
  const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
  const DATE = new RegExp(`((${MONTH}\\s+)?(19|20)\\d{2}|\\d{1,2}/(19|20)?\\d{2})(\\s*(-|\u2013|\u2014|to)\\s*((${MONTH}\\s+)?(19|20)\\d{2}|\\d{1,2}/(19|20)?\\d{2}|present|current|now))?`, 'i');
  const DATE_AT_END = new RegExp(`\\s*[|,\u00b7\u2022\\t-]?\\s*(${DATE.source})\\s*$`, 'i');
  const norm = (t) => t.toLowerCase().replace(/[:\s]+$/, '').replace(/\s+/g, ' ').trim();
  const isHeading = (l) => {
    const t = l.text.trim(); const n = norm(t);
    if (!t || t.length > 40) return false;
    if (SECTIONS.includes(n)) return true;
    return l.heading && t.split(/\s+/).length <= 4 || (/^[A-Z&/ ,]+:?$/.test(t) && /[A-Z]{3}/.test(t) && t.split(/\s+/).length <= 4 && !DATE.test(t));
  };
  const kindOf = (title) => {
    const n = norm(title);
    if (/experience|employment|work history/.test(n)) return 'exp';
    if (/project|research|leadership|volunteer/.test(n)) return 'exp';
    if (/skill|competenc|languages/.test(n)) return 'skills';
    if (/education|courses|training/.test(n)) return 'edu';
    if (/summary|profile|objective|about/.test(n)) return 'summary';
    return 'list';
  };

  function structure(lines) {
    // Glue "\u2022" on its own line to the line after it.
    const L = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.text) continue;
      if (LONE_BULLET.test(l.text) && lines[i + 1]) { L.push({ ...lines[i + 1], text: lines[i + 1].text, bullet: true }); i++; continue; }
      if (BULLET.test(l.text) && l.text.replace(BULLET, '').length > 1) { L.push({ ...l, text: l.text.replace(BULLET, ''), bullet: true }); continue; }
      L.push({ ...l, text: l.text.replace(/\s*[\u2022\u25cf\u25aa]\s*$/, '') });
    }
    if (!L.length) return null;
    // Name: the largest text near the top (PDF), else the first line.
    let nameIdx = 0;
    const top = L.slice(0, 4); const big = top.reduce((a, b) => (b.size > a.size ? b : a), top[0]);
    if (big.size) nameIdx = L.indexOf(big);
    const model = { name: L[nameIdx].text.replace(/\t+/g, ' '), contact: [], sections: [] };
    let i = nameIdx + 1;
    for (; i < L.length && !isHeading(L[i]); i++) {
      // Some PDFs put the first heading at the end of the contact line ("... github.com/x SUMMARY").
      const m = L[i].text.match(/^(.*?)\s+([A-Z][A-Z &]{4,})$/);
      if (m && SECTIONS.includes(norm(m[2]))) { model.contact.push(m[1]); L[i] = { text: m[2] }; break; }
      model.contact.push(L[i].text.replace(/\t+/g, ' | '));
    }
    let sec = null, baseX = null, prevText = '';
    const prevItem = () => sec && sec.items[sec.items.length - 1];
    // PDFs often draw bullets as shapes, so a line indented past the section's left edge is bullet text.
    const sectionBase = (from) => { let m = Infinity; for (let k = from; k < L.length && !isHeading(L[k]); k++) if (L[k].x !== undefined && !L[k].bullet) m = Math.min(m, L[k].x); return m === Infinity ? null : m; };
    for (; i < L.length; i++) {
      const l = L[i]; let t = l.text.replace(/\s+$/, '');
      if (isHeading(l)) { sec = { title: t.replace(/:$/, '').toUpperCase(), kind: kindOf(t), items: [] }; model.sections.push(sec); baseX = sectionBase(i + 1); prevText = ''; continue; }
      const indented = baseX !== null && l.x !== undefined && l.x > baseX + 6 && !l.bullet;
      if (indented && sec && sec.kind !== 'summary' && sec.kind !== 'skills') {
        const last0 = prevItem(), ended = /[.!?;:)]$/.test(prevText);
        if (last0 && last0.type === 'b' && !(ended && /^[A-Z0-9]/.test(t)) && l.gapBefore < 1.45) last0.text += ' ' + t;
        else sec.items.push({ type: 'b', text: t });
        prevText = t; continue;
      }
      prevText = t;
      if (!sec) { sec = { title: 'SUMMARY', kind: 'summary', items: [] }; model.sections.push(sec); }
      // Some PDFs glue the next heading to the end of a line: "...Objective-C AI & LLMs:" handled by skills; "... Coin" fine.
      const last = prevItem();
      const newPara = l.bullet || !last || l.gapBefore > 1.45 || l.size === 0;
      if (sec.kind === 'summary') {
        if (last && !newPara) last.text += ' ' + t; else sec.items.push({ type: 'p', text: t });
        continue;
      }
      if (l.bullet) { sec.items.push({ type: 'b', text: t }); continue; }
      if (sec.kind === 'exp' || sec.kind === 'edu') {
        const hasDate = DATE.test(t) && (DATE_AT_END.test(t) || /\t/.test(t));
        if (hasDate) {
          const m = t.match(DATE_AT_END);
          const date = m ? m[1].trim() : '';
          const head = (m ? t.slice(0, m.index) : t).replace(/\t+/g, ' | ').replace(/[\s|,\u2013-]+$/, '').trim();
          sec.items.push({ type: sec.kind === 'edu' ? 'e' : 'j', text: head, date });
          continue;
        }
        // A wrapped bullet continues the previous bullet; a short line after a job line is its title.
        if (last && last.type === 'b' && !newPara && !/^[A-Z][^.]{0,60}$/.test(t) || (last && last.type === 'b' && /^[a-z(]/.test(t))) { last.text += ' ' + t; continue; }
        if (last && (last.type === 'j' || last.type === 'e') && !last.sub && t.length < 90) { last.sub = t.replace(/\t+/g, ' | '); continue; }
        if (last && last.type === 'b' && !newPara) { last.text += ' ' + t; continue; }
        sec.items.push({ type: 'p', text: t.replace(/\t+/g, ' | ') });
        continue;
      }
      if (sec.kind === 'skills') {
        // Split "Languages: a, b Frontend: c, d" when converters glue two labels onto one line.
        const parts = (t.match(/:/g) || []).length >= 2 ? t.split(/\s(?=(?:[A-Z&][\w&/+.()-]*\s?){1,3}:\s)/) : [t];
        for (const part of parts) {
          const m = part.match(/^([^:]{2,45}):\s*(.*)$/);
          if (m) sec.items.push({ type: 's', label: m[1].trim(), text: m[2].trim() });
          else if (last && last.type === 's' && !newPara) last.text += ' ' + part;
          else sec.items.push({ type: 'p', text: part });
        }
        continue;
      }
      if (last && last.type !== 'b' && !newPara) last.text += ' ' + t; else sec.items.push({ type: 'p', text: t.replace(/\t+/g, ' | ') });
    }
    // Education lines without dates still read better as entries.
    for (const s of model.sections) if (s.kind === 'edu') for (const it of s.items) if (it.type === 'p') it.type = 'e';
    const words = model.sections.reduce((n, s) => n + s.items.reduce((m, it) => m + String(it.text || '').split(/\s+/).length, 0), 0);
    if (model.sections.length < 2 || words < 60) return null; // too little structure to trust
    return model;
  }

  // ---------- 3. Fit to the original page count ----------
  const IN = 72; // points per inch
  function measure(model, size, margin) {
    const c = measure.c || (measure.c = document.createElement('canvas').getContext('2d'));
    const width = 8.5 * IN - 2 * margin;
    const lineH = size * 1.18;
    const linesFor = (txt, sz, bold, w) => { c.font = `${bold ? 'bold ' : ''}${sz}px Arial, "Liberation Sans", Helvetica, sans-serif`; return Math.max(1, Math.ceil((c.measureText(txt).width * 1.0) / w)); };
    let h = (size + 7) * 1.25 + model.contact.length * (size - 0.5) * 1.25;
    for (const s of model.sections) {
      h += (size + 1) * 1.3 + 8;
      for (const it of s.items) {
        if (it.type === 'b') h += linesFor(it.text, size, false, width - 14) * lineH + 1;
        else if (it.type === 'j' || it.type === 'e') h += linesFor(it.text + '    ' + (it.date || ''), size + (it.type === 'j' ? 0.5 : 0), true, width) * lineH + (it.type === 'j' ? 4 : 1) + (it.sub ? lineH : 0);
        else if (it.type === 's') h += linesFor(it.label + ': ' + it.text, size, false, width) * lineH + 1;
        else h += linesFor(it.text, size, false, width) * lineH + 2;
      }
    }
    return h;
  }
  function fit(model, pages) {
    const target = Math.max(1, pages || 1);
    const sizes = [11, 10.5, 10, 9.5, 9];
    const margins = [0.75, 0.6, 0.5, 0.45].map((m) => m * IN);
    for (const size of sizes) for (const margin of margins) {
      const need = measure(model, size, margin) * 1.03; // safety
      if (need <= target * (11 * IN - 2 * margin)) return { size, margin, pages: target };
    }
    return { size: 9, margin: 0.45 * IN, pages: target };
  }

  // ---------- 4. Write the Word file ----------
  async function toDocx(model, fitInfo) {
    await load(LIBS.docx);
    const D = window.docx;
    const pt = (n) => Math.round(n * 2); // half-points
    const tw = (n) => Math.round(n * 20); // twips
    const { size, margin } = fitInfo;
    const NAVY = '283C8C', GREY = '5A6173', INK = '1C2130';
    const right = tw(8.5 * IN - 2 * margin);
    const run = (text, o = {}) => new D.TextRun({ text, font: 'Arial', size: pt(o.size || size), bold: !!o.bold, italics: !!o.italic, color: o.color || INK });
    const kids = [];
    kids.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 20 }, children: [run(model.name, { size: size + 7, bold: true, color: NAVY })] }));
    for (const c of model.contact) kids.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 20 }, children: [run(c, { size: size - 0.5, color: GREY })] }));
    for (const s of model.sections) {
      kids.push(new D.Paragraph({ spacing: { before: tw(7), after: tw(2) }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: '9AA3B8', space: 1 } },
        children: [run(s.title, { size: size + 1, bold: true, color: NAVY })] }));
      for (const it of s.items) {
        if (it.type === 'b') kids.push(new D.Paragraph({ numbering: { reference: 'dot', level: 0 }, spacing: { after: tw(1) }, children: [run(it.text)] }));
        else if (it.type === 'j' || it.type === 'e') {
          const head = it.text.split(' | ');
          const children = [run(head[0], { bold: true, size: it.type === 'j' ? size + 0.5 : size })];
          if (head.length > 1) children.push(run(' | ' + head.slice(1).join(' | '), { bold: it.type === 'j', size: it.type === 'j' ? size + 0.5 : size }));
          if (it.date) children.push(new D.TextRun({ text: '\t' + it.date, font: 'Arial', size: pt(size), italics: true, color: GREY }));
          kids.push(new D.Paragraph({ tabStops: [{ type: D.TabStopType.RIGHT, position: right }], spacing: { before: it.type === 'j' ? tw(4) : 0, after: tw(1) }, children }));
          if (it.sub) kids.push(new D.Paragraph({ spacing: { after: tw(1) }, children: [run(it.sub, { italic: true, color: GREY })] }));
        } else if (it.type === 's') kids.push(new D.Paragraph({ spacing: { after: tw(1) }, children: [run(it.label + ': ', { bold: true }), run(it.text)] }));
        else kids.push(new D.Paragraph({ spacing: { after: tw(2) }, children: [run(it.text)] }));
      }
    }
    const doc = new D.Document({
      styles: { default: { document: { run: { font: 'Arial', size: pt(size) }, paragraph: { spacing: { line: 240 } } } } },
      numbering: { config: [{ reference: 'dot', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '\u2022', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 240, hanging: 180 } } } }] }] },
      sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: tw(margin * 0.8), bottom: tw(margin * 0.75), left: tw(margin), right: tw(margin) } } }, children: kids }],
    });
    return D.Packer.toBlob(doc);
  }

  // ---------- Public ----------
  // Returns { blob, mime, pages, formatted } \u2014 formatted=false means "upload the original as-is".
  async function format(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    const read = ext === 'pdf' ? await readPdf(buf) : ext === 'docx' ? await readDocx(buf) : null;
    if (!read) return { formatted: false };
    const model = structure(read.lines);
    if (!model) return { formatted: false, pages: read.pages };
    const pages = read.pages || Math.ceil(measure(model, 11, 0.75 * IN) / (11 * IN - 1.5 * IN));
    const f = fit(model, Math.min(pages, 3));
    const blob = await toDocx(model, f);
    return { formatted: true, blob, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pages: f.pages, model, fit: f };
  }
  return { format, structure, readPdf, readDocx, measure, LIBS };
})();
