(async () => {
  if (window.__aiFillRunning) { alert('स्क्रिप्ट पहले से चल रही है। रुकवाना हो तो पेज refresh करो।'); return; }
  window.__aiFillRunning = true; window.__aiStop = false;

  // ================= तुम्हारा डेटा (सिर्फ़ यही हिस्सा बदलना है) =================
  const RESUME = `
YOUR NAME
YOUR TARGET TITLE | KEY SKILL 1 | KEY SKILL 2
Your City, State | +91 XXXXXXXXXX | your.email@example.com | linkedin.com/in/your-profile

PROFESSIONAL SUMMARY
(Paste your own summary here.)

CORE SKILLS
(Paste your own skills here.)

WORK EXPERIENCE
Job Title, Company | City | Mon YYYY - Present
- (Paste your own bullet points here.)

EDUCATION
(Degree, University, year)
`;
  // जो जानकारी रेज्यूम में नहीं है, उसे यहाँ एक बार भर दो। फिर स्क्रिप्ट हर साइट पर यही इस्तेमाल करेगी और तुमसे नहीं पूछेगी।
  // जो "not provided" है उसे बदल दो (जैसे Date of Birth: 15/08/1996)।
  const PROFILE = `
Full name: Your Name
Email: your.email@example.com
Phone: XXXXXXXXXX (India, +91)
Title: Mr/Ms
Gender: (your answer)
Date of Birth: DD Month YYYY (day DD, month MM, year YYYY). Check the field's format (DD/MM/YYYY or MM/DD/YYYY) before typing
Nationality: (your nationality)
Work authorisation: (your answer, e.g. citizen, authorised to work, no sponsorship needed)
Address line 1: (type EXACTLY this text). City: Your City. State: Your State. Country: Your Country. Pincode: XXXXXX
Education (enter ALL of these as separate entries, newest first):
  1) Degree, University, completed Month YYYY
  2) (another qualification, if any)
  3) Class XII: board, school, passed YYYY, percentage XX%
Languages: (your languages)
Current employer: (employer)
Total experience: (years)
Current CTC: (amount)
Expected CTC: (amount); (negotiable or not)
Notice period: (your answer)
Preferred locations: (your list)
Work mode: (your answer)
Disability: (your answer)
Legal/background declarations (the candidate's own answers, which he/she states are true): ever dismissed for misconduct: (answer). Criminal convictions or cases: (answer). Conflict of interest: (answer). Relatives at the company: (answer). Legal right to work in the job's country: (answer). Consent to screening and background checks, data privacy and terms: (answer). Any other yes/no question that is clearly a variation of the above: answer the same way. If it is something different, ask the candidate.
Marital status, caste/category, religion and other voluntary questions: prefer not to say / decline to answer
Where I found the job / "How did you hear about us": LinkedIn
`;
  // पासवर्ड सिर्फ़ तुम्हारे browser में रहता है। स्क्रिप्ट उसे खुद टाइप करती है और AI को कभी नहीं भेजा जाता।
  // SECURITY: never hard-code a real password in a file that goes on GitHub.
  // Leave this empty. Then the agent will ask you to type passwords yourself.
  // If you really want auto-typing, set it locally for your own run and NEVER commit it.
  const PASSWORD = '';
  // AI = Google Gemini (free tier). मॉडल नीचे GMODELS में हैं; limit पूरी होने पर अपने-आप अगला मॉडल लगता है।
  const MAX_TURNS = 80;
  const AUTO_SUBMIT = false;   // false = आख़िरी Submit तुम खुद दबाओगे (सुझाव: false ही रखो)

  // ================= API key =================
  // ===== इस टैब की अस्थायी याददाश्त: पेज reload होने पर भी बनी रहती है, टैब बंद होते ही मिट जाती है =====
  const SS = {
    get: k => { try { return sessionStorage.getItem('aiJA:' + k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem('aiJA:' + k, v); } catch (e) {} },
    del: k => { try { sessionStorage.removeItem('aiJA:' + k); } catch (e) {} }
  };
  let RUN = {};
  try { RUN = JSON.parse(SS.get('run') || '{}'); } catch (e) {}
  if (!(RUN.ts && Date.now() - RUN.ts < 5 * 60 * 1000 && RUN.turns)) RUN = {};   // 5 मिनट से पुरानी अधूरी run को भूल जाओ
  if (RUN.turns) console.log('↻ पिछली run से आगे बढ़ रहा हूँ (टर्न ' + RUN.turns + ' के बाद से)');
  let KEY = SS.get('gkey') || (prompt('Gemini API key यहाँ paste करो (मुफ़्त में aistudio.google.com/apikey से मिलती है):') || '').trim();
  if (!KEY) { window.__aiFillRunning = false; return; }
  if (/^sk-ant/.test(KEY) || KEY.length < 20 || /\s/.test(KEY)) { alert('ये Gemini key नहीं लग रही (Claude वाली sk-ant... या बहुत छोटी/space वाली है). aistudio.google.com/apikey वाली key दोबारा डालो.'); window.__aiFillRunning = false; return; }
  SS.set('gkey', KEY);

  console.log('🚀 AI form-filler शुरू हो गया (v3)');
  const _d = new Date(), TODAY = _d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' (' + _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0') + ')';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const low = s => clean(s).toLowerCase();
  const winOf = el => el.ownerDocument.defaultView;
  const MEMO = RUN.memo || [];
  const log = (...a) => console.log(...a);
  const inUI = el => !!(el.closest && el.closest('#__ai_dlg, #__ai_bar'));

  // ===== पेज के network errors (HTTP 400+) पर नज़र: ताकि AI देख सके कि कौन सा upload/save सच में फेल हुआ =====
  const NETERR = [];
  const noteErr = m => {
    m = clean(m).slice(0, 170);
    if (m && !NETERR.some(e => e.m === m && Date.now() - e.t < 4000)) NETERR.push({ t: Date.now(), m });
    if (NETERR.length > 30) NETERR.shift();
  };
  window.__aiNetSink = noteErr;
  try {
    if (!window.__aiNetPatched) {
      window.__aiNetPatched = true;
      const sink = m => { try { window.__aiNetSink && window.__aiNetSink(m); } catch (e) {} };
      const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u) { try { this.__ai = { m, u: String(u) }; } catch (e) {} return xo.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        try { this.addEventListener('loadend', () => { if (this.__ai && this.status >= 400) sink(this.status + ' ' + this.__ai.m + ' ' + this.__ai.u.replace(/^https?:\/\/[^/]+/, '')); }); } catch (e) {}
        return xs.apply(this, arguments);
      };
      const of = window.fetch;
      window.fetch = function (...a) {
        const u = String((a[0] && a[0].url) || a[0] || '');
        return of.apply(this, a).then(r => { try { if (r.status >= 400 && !u.includes('generativelanguage.googleapis.com')) sink(r.status + ' ' + ((a[1] && a[1].method) || 'GET') + ' ' + u.replace(/^https?:\/\/[^/]+/, '')); } catch (e) {} return r; });
      };
    }
  } catch (e) {}

  // ===== इस साइट के बारे में सीखी हुई बातें (उसी साइट पर अगली बार काम आती हैं) =====
  const NOTE_KEY = 'aiFillNotes:' + location.hostname;
  const loadNotes = () => { try { return JSON.parse(localStorage.getItem(NOTE_KEY) || '[]'); } catch (e) { return []; } };
  const saveNote = n => {
    try { const l = loadNotes(); n = clean(n).slice(0, 220); if (n && !l.includes(n)) { l.push(n); localStorage.setItem(NOTE_KEY, JSON.stringify(l.slice(-12))); } } catch (e) {}
  };

  // ================= Gemini API (free tier) =================
  const USAGE = RUN.usage || { in: 0, cacheRead: 0, cacheWrite: 0, out: 0, calls: 0 };
  const GMODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];   // पहला सबसे समझदार; limit/404 पर अगला
  const MIN_GAP = 0;   // दो कॉल के बीच कम से कम इतने ms (free limit से बचने के लिए)
  const THINK = [{ thinkingBudget: 0 }, { thinkingLevel: 'minimal' }, null]; let thinkI = 0, aborts = 0;   // सोचने (thinking) का समय बंद/कम
  let gi = Math.min(+(SS.get('gmodel') || 0) || 0, GMODELS.length - 1), lastCall = 0;
  const nap = async (ms, why) => {
    const end = Date.now() + ms;
    while (Date.now() < end && !window.__aiStop) { setBar('⏳ ' + why + ' (' + Math.ceil((end - Date.now()) / 1000) + ' सेकंड)', stopBtn); await sleep(500); }
  };
  const nextModel = why => { if (gi < GMODELS.length - 1) { log('🔁 ' + GMODELS[gi] + ' छोड़कर ' + GMODELS[gi + 1] + ' पर जा रहा हूँ (' + why + ')'); gi++; SS.set('gmodel', String(gi)); return true; } return false; };
  async function callGemini(system, user) {
    let json = true;
    for (let attempt = 1; attempt <= 8; attempt++) {
      if (window.__aiStop) return '{"thought":"stopped","actions":[]}';
      const gap = MIN_GAP - (Date.now() - lastCall);
      if (gap > 0) await nap(gap, 'Gemini की free limit के लिए थोड़ा रुक रहा हूँ');
      lastCall = Date.now();
      const model = GMODELS[gi];
      let r, j;
      const ctl = new AbortController(); const tmo = setTimeout(() => ctl.abort(), 40000);   // 40 सेकंड में जवाब नहीं आया तो रोको
      try {
        r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: Object.assign({ maxOutputTokens: 8192, temperature: 0.2 }, THINK[thinkI] ? { thinkingConfig: THINK[thinkI] } : {}, json ? { responseMimeType: 'application/json' } : {})
          })
        });
        j = await r.json().catch(() => ({}));
        clearTimeout(tmo);
      } catch (e) {
        clearTimeout(tmo);
        if (e.name === 'AbortError') { aborts++; log('⏱ Gemini 40 सेकंड में नहीं बोला (' + model + ')'); if (aborts >= 2) { aborts = 0; nextModel('जवाब बहुत धीमा'); } continue; }
        throw new Error('Gemini API error: इस साइट ने Google को कॉल करने से रोका या नेट नहीं है (' + e.message + '). कुछ साइटें बाहर की API कॉल रोकती हैं।');
      }
      if (r.ok) {
        const u = j.usageMetadata || {};
        USAGE.calls++; USAGE.in += u.promptTokenCount || 0; USAGE.cacheRead += u.cachedContentTokenCount || 0; USAGE.out += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
        log(`💰 टोकन (इस कॉल में, ${model}): input ${u.promptTokenCount || 0}, output ${(u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)}`);
        const cand = j.candidates && j.candidates[0];
        const text = cand && cand.content && cand.content.parts ? cand.content.parts.filter(p => !p.thought).map(p => p.text || '').join('') : '';
        if (text) return text;
        log('⚠️ Gemini ने खाली जवाब दिया', cand && cand.finishReason, j.promptFeedback || '');
        await nap(3000, 'खाली जवाब मिला, दोबारा पूछ रहा हूँ'); continue;
      }
      const st = r.status, msg = (j.error && j.error.message) || '', raw = JSON.stringify(j);
      if (st === 400 && /think|invalid argument/i.test(msg) && thinkI < THINK.length - 1) { thinkI++; log('↪ thinking सेटिंग बदली'); continue; }
      if (st === 400 && /invalid argument/i.test(msg) && nextModel('400 invalid argument')) { thinkI = 0; continue; }
      if (st === 400 && json && /mime|json mode|responseMimeType/i.test(msg)) { json = false; continue; }
      if (st === 400 && /API key not valid|API_KEY_INVALID/i.test(raw)) { SS.del('gkey'); throw new Error('Gemini API error 400: API key गलत है। स्क्रिप्ट दोबारा चलाकर सही key डालो।'); }
      if (st === 404 || (st === 400 && /not found|not supported|unsupported/i.test(msg))) { if (nextModel('मॉडल उपलब्ध नहीं')) continue; throw new Error('Gemini API error ' + st + ': ' + msg.slice(0, 250)); }
      if (st === 429) {
        if (nextModel('इस मॉडल की free limit पूरी, बिना रुके अगला मॉडल')) { thinkI = 0; continue; }   // इंतज़ार नहीं, सीधे दूसरा मॉडल
        const m = msg.match(/retry in ([\d.]+)s/i) || raw.match(/"retryDelay":\s*"([\d.]+)s"/);
        const perDay = /per ?day|daily/i.test(raw);
        if (perDay || (!m && attempt >= 3)) {
          if (nextModel('इस मॉडल की रोज़ की free limit पूरी')) continue;
          throw new Error('Gemini API error 429: आज की free limit सब मॉडल की पूरी हो गई। कल (लगभग दोपहर 12:30–1:30 बजे IST पर रीसेट) फिर चलाओ।');
        }
        await nap(Math.min((m ? +m[1] : 20) + 2, 75) * 1000, 'Gemini की free limit, इंतज़ार'); continue;
      }
      if ([500, 502, 503, 504].includes(st)) { await nap(4000 * attempt, 'Gemini व्यस्त है, दोबारा कोशिश'); continue; }
      throw new Error('Gemini API error ' + st + ': ' + msg.slice(0, 300));
    }
    throw new Error('Gemini API error: कई बार कोशिश के बाद भी जवाब नहीं मिला');
  }
  const parse = t => {
    t = t.replace(/```json|```/g, '');
    const st = t.indexOf('{'); if (st < 0) throw new Error('no json');
    let depth = 0, inStr = false, esc = false;
    for (let i = st; i < t.length; i++) {
      const c = t[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) return JSON.parse(t.slice(st, i + 1)); }
    }
    return JSON.parse(t.slice(st, t.lastIndexOf('}') + 1));
  };
  async function callGeminiJSON(system, user) {
    const ok = p => p && typeof p === 'object' && Array.isArray(p.actions);
    let raw = '';
    try { raw = await callGemini(system, user); const p = parse(raw); if (ok(p)) return p; throw new Error('bad shape'); }
    catch (e) {
      if (/API error/.test(e.message)) throw e;
      log('⚠️ जवाब का JSON ठीक नहीं था, दोबारा माँग रहा हूँ। मिला:', String(raw).slice(0, 200));
      try {
        raw = await callGemini(system, user + '\n\nYour last reply was not valid. Reply with ONLY one JSON object of the form {"thought":"...","actions":[...]}.');
        const p = parse(raw); if (ok(p)) return p;
      } catch (e2) { if (/API error/.test(e2.message)) throw e2; }
      return { thought: 'invalid reply, waiting', actions: [{ do: 'wait' }] };
    }
  }

  // ================= ऊपर की status पट्टी =================
  function setBar(msg, btn) {
    let b = document.getElementById('__ai_bar');
    if (!msg) { b?.remove(); return; }
    if (!b) {
      b = document.createElement('div'); b.id = '__ai_bar';
      Object.assign(b.style, { position: 'fixed', top: '0', left: '0', right: '0', zIndex: 2147483646, background: '#1a237e', color: '#fff',
        padding: '10px 16px', fontFamily: 'system-ui,sans-serif', fontSize: '15px', display: 'flex', gap: '12px', alignItems: 'center' });
      document.body.appendChild(b);
    }
    b.textContent = '';
    const s = document.createElement('span'); s.textContent = msg; b.appendChild(s);
    const hint = document.createElement('span'); hint.textContent = '↻ पट्टी गायब हो जाए तो Console में ↑ फिर Enter'; Object.assign(hint.style, { marginLeft: 'auto', fontSize: '12px', opacity: '.75' }); b.appendChild(hint);
    if (btn) {
      const x = document.createElement('button'); x.type = 'button'; x.textContent = btn.label;
      Object.assign(x.style, { padding: '6px 12px', borderRadius: '6px', border: '0', cursor: 'pointer', background: '#ffb300', color: '#000', fontSize: '14px' });
      x.onclick = btn.onClick; b.appendChild(x);
    }
  }
  const stopBtn = { label: '⛔ रोको', onClick: () => { window.__aiStop = true; } };

  // ================= सवाल का डायलॉग (माइक तुरंत चालू) =================
  function dialog({ kind, title, text, input = false, okLabel = 'OK', skipLabel = null, mic = false }) {
    return new Promise(resolve => {
      document.getElementById('__ai_dlg')?.remove();
      const el = (tag, css, txt) => { const e = document.createElement(tag); Object.assign(e.style, css || {}); if (txt) e.textContent = txt; return e; };
      const wrap = el('div', { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.45)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' });
      wrap.id = '__ai_dlg'; wrap.dataset.kind = kind || '';
      const box = el('div', { background: '#fff', color: '#111', padding: '22px', borderRadius: '14px', width: 'min(560px,92vw)', fontFamily: 'system-ui,sans-serif', fontSize: '16px', boxShadow: '0 10px 40px rgba(0,0,0,.4)' });
      box.appendChild(el('div', { fontWeight: '700', fontSize: '18px', marginBottom: '10px' }, title));
      box.appendChild(el('div', { marginBottom: '12px', whiteSpace: 'pre-wrap' }, text));
      const inp = el('textarea', { width: '100%', height: '110px', resize: 'vertical', boxSizing: 'border-box', padding: '10px', fontSize: '16px', border: '2px solid #888', borderRadius: '8px', fontFamily: 'inherit', display: input ? 'block' : 'none' });
      inp.id = '__ai_dlg_input'; inp.placeholder = 'बोलो या यहाँ लिखो'; inp.autocomplete = 'off';
      box.appendChild(inp);
      const status = el('div', { margin: '8px 0', fontSize: '14px', color: '#555', minHeight: '18px' });
      box.appendChild(status);
      const row = el('div', { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' });
      const mkBtn = (label, bg, fg) => { const b = el('button', { padding: '10px 16px', fontSize: '15px', border: '0', borderRadius: '8px', background: bg, color: fg, cursor: 'pointer' }, label); b.type = 'button'; return b; };
      const bMic = mic ? mkBtn('🎤 बोलना शुरू', '#e8eaf6', '#111') : null;
      const bLang = mic ? mkBtn('भाषा: English', '#e8eaf6', '#111') : null;
      const bSkip = skipLabel ? mkBtn(skipLabel, '#eee', '#111') : null;
      const bOk = mkBtn(okLabel, '#d04a02', '#fff'); bOk.id = '__ai_dlg_ok';
      [bMic, bLang, bSkip, bOk].forEach(b => b && row.appendChild(b));
      box.appendChild(row); wrap.appendChild(box); document.body.appendChild(wrap);

      let timer = null, rec = null, closed = false, micOn = false, lang = 'en-IN', base = '';
      // dialog के events पेज के भारी handlers तक पहुँचने ही नहीं देते (यही typing का lag था)
      const guard = e => { if (!closed && wrap.contains(e.target)) e.stopImmediatePropagation(); };
      const GUARD_EV = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'focusin', 'focusout', 'compositionstart', 'compositionupdate', 'compositionend'];
      GUARD_EV.forEach(t => { window.addEventListener(t, guard, true); });
      const trap = e => { if (!closed && !wrap.contains(e.target)) { e.stopImmediatePropagation(); if (input) inp.focus(); } };
      document.addEventListener('focusin', trap, true);
      const finish = v => { closed = true; clearTimeout(timer); document.removeEventListener('focusin', trap, true); GUARD_EV.forEach(t => window.removeEventListener(t, guard, true)); try { rec && rec.stop(); } catch (e) {} wrap.remove(); resolve(v); };
      bOk.onclick = () => finish(input ? inp.value.trim() : 'ok');
      if (bSkip) bSkip.onclick = () => finish(null);
      inp.addEventListener('input', () => { if (micOn) { micOn = false; try { rec && rec.stop(); } catch (e) {} bMic && (bMic.textContent = '🎤 बोलना शुरू'); status.textContent = 'लिख रहे हो... पूरा होने पर OK दबाओ'; } });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bOk.click(); } });
      if (input) setTimeout(() => inp.focus(), 50);

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      // लंबा बोलना: माइक लगातार चलता है, रुकता नहीं; जो बोला वो textbox में जुड़ता जाता है। OK तुम खुद दबाओगे।
      const listen = () => {
        if (closed || !micOn) return;
        if (!SR) { status.textContent = 'इस browser में माइक नहीं है, यहाँ लिखो।'; micOn = false; inp.focus(); return; }
        try {
          rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = true;
          base = inp.value.trim() ? inp.value.trim() + ' ' : '';
          rec.onresult = e => {
            let fin = '', interim = '';
            for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript + ' '; else interim += r[0].transcript; }
            if (fin) inp.value = (base + fin).trim();
            status.textContent = interim ? '🎤 ' + interim : '🎤 सुन रहा हूँ... बोलते रहो, पूरा होने पर OK दबाओ';
          };
          rec.onerror = e => { if (e.error === 'no-speech' || e.error === 'aborted') return; micOn = false; bMic.textContent = '🎤 बोलना शुरू'; status.textContent = '🎤 माइक में दिक्कत (' + e.error + '), यहाँ लिखो।'; };
          rec.onend = () => { if (!closed && micOn) setTimeout(listen, 150); };
          rec.start();
        } catch (e) { micOn = false; status.textContent = 'माइक शुरू नहीं हुआ, यहाँ लिखो।'; }
      };
      const toggleMic = () => {
        micOn = !micOn;
        bMic.textContent = micOn ? '⏹ माइक बंद' : '🎤 बोलना शुरू';
        if (micOn) { status.textContent = '🎤 सुन रहा हूँ...'; listen(); } else { try { rec && rec.stop(); } catch (e) {} status.textContent = ''; }
      };
      if (bMic) bMic.onclick = toggleMic;
      if (bLang) bLang.onclick = () => {
        lang = lang === 'en-IN' ? 'hi-IN' : 'en-IN';
        bLang.textContent = lang === 'en-IN' ? 'भाषा: English' : 'भाषा: हिंदी';
        if (micOn) { try { rec && rec.stop(); } catch (e) {} }   // onend अपने-आप नई भाषा में दोबारा शुरू करेगा
      };
      if (mic) { micOn = true; bMic.textContent = '⏹ माइक बंद'; listen(); }
    });
  }

  // ================= पेज पढ़ने के औज़ार (iframes समेत) =================
  const allDocs = () => {
    const d = [document];
    document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument) d.push(f.contentDocument); } catch (e) {} });
    return d;
  };
  const queryAll = sel => allDocs().flatMap(d => [...d.querySelectorAll(sel)]);
  const deepAll = sel => {   // open shadow roots के अंदर भी ढूँढता है
    const out = [];
    const walk = root => { root.querySelectorAll(sel).forEach(e => out.push(e)); root.querySelectorAll('*').forEach(e => { if (e.shadowRoot) walk(e.shadowRoot); }); };
    allDocs().forEach(walk);
    return out;
  };
  const visible = el => {
    if (!el.getClientRects().length) return false;
    const s = winOf(el).getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  const tiny = el => { const r = el.getBoundingClientRect(); return r.width < 2 || r.height < 2; };
  const byFor = el => el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent;
  function labelText(el) {
    let t = el.getAttribute('aria-label') || '';
    const ids = el.getAttribute('aria-labelledby');
    if (!t && ids) t = ids.split(' ').map(i => el.ownerDocument.getElementById(i)?.textContent || '').join(' ');
    if (!t) t = byFor(el) || el.closest('label')?.textContent || '';
    if (!t) {
      const up = n => n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
      let p = up(el);
      for (let i = 0; i < 5 && p; i++, p = up(p)) {
        const x = clean(p.textContent);
        if (x.length >= 3 && x.length <= 250) { t = x; break; }
      }
    }
    return clean(t || el.placeholder || el.name || el.id).slice(0, 200);
  }
  const optLabel = el => clean(el.getAttribute('aria-label') || byFor(el) || el.closest('label')?.textContent ||
    el.nextElementSibling?.textContent || el.nextSibling?.textContent || el.value).slice(0, 200);
  const groupLabel = el => {
    const fs = el.closest('fieldset,[role=radiogroup],[role=group]');
    return clean(fs?.querySelector('legend')?.textContent || fs?.getAttribute('aria-label') || fs?.textContent || labelText(el)).slice(0, 200);
  };
  const btnText = b => clean(b.innerText || b.value || b.getAttribute('aria-label') || b.getAttribute('title')).replace(/[>›»→]+$/g, '').trim().slice(0, 80);
  const getErrors = () => [...new Set(
    queryAll('[role=alert], .error, .errorMessage, .errormessage, [class*=error], [class*=Error], .help-block, .field-error')
      .filter(e => visible(e) && !inUI(e)).map(e => clean(e.textContent)).filter(t => t && t.length < 200)
  )].slice(0, 8);

  const BTN_SEL = 'button, input[type=submit], input[type=button], a[role=button], [role=button]';
  const DIALOG_SEL = '[role=dialog],[role=alertdialog],[aria-modal=true],.ui-dialog,.modal,.modal-dialog,[class*=dialog],[class*=Dialog],[class*=modal],[class*=Modal],[class*=popup],[class*=Popup],[class*=overlay]';
  const bigVisible = el => {
    if (!visible(el) || inUI(el) || /^(BODY|HTML)$/.test(el.tagName)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 200 && r.height > 100;
  };
  const overlayish = el => el.matches('[role=dialog],[role=alertdialog],[aria-modal=true]') || /fixed|absolute/.test(winOf(el).getComputedStyle(el).position);
  function findDialogs() {
    const c = queryAll(DIALOG_SEL).filter(e => bigVisible(e) && overlayish(e) && e.querySelector(BTN_SEL));
    return c.map(d => {
      let x = d;
      while (x.parentElement && c.includes(x.parentElement)) {
        const r = x.parentElement.getBoundingClientRect(), W = winOf(x);
        if (r.width * r.height > 0.9 * W.innerWidth * W.innerHeight) break;
        x = x.parentElement;
      }
      return x;
    }).filter((x, i, a) => a.indexOf(x) === i);
  }
  const findDialog = () => { const l = findDialogs(); return l[l.length - 1] || null; };
  const scrollAll = root => {
    root.querySelectorAll('*').forEach(e => {
      if (e.scrollHeight > e.clientHeight + 5 && /auto|scroll/.test(winOf(e).getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight;
    });
    if (root.scrollHeight > root.clientHeight + 5) root.scrollTop = root.scrollHeight;
    root.querySelectorAll('iframe').forEach(f => { try { f.contentWindow.scrollTo(0, 1e7); f.contentDocument.documentElement.scrollTop = 1e7; } catch (e) {} });
  };

  const pageText = () => clean(allDocs().map(d => d.body?.innerText || '').join(' ')).slice(0, 2000);
  const visiblePw = () => deepAll('input[type=password]').filter(p => visible(p) && !inUI(p));
  const emptyPwd = () => visiblePw().filter(p => !p.value).length;
  const emptyFiles = () => deepAll('input[type=file]').filter(f => !f.disabled && !f.files.length && !inUI(f)).length;
  const fingerprint = () => {
    const hs = queryAll('h1,h2').filter(visible).map(h => clean(h.textContent)).join('/');
    const n = queryAll('input,select,textarea').filter(e => visible(e) && !inUI(e)).length;
    return location.href + '|' + hs + '|' + n + '|' + (findDialog() ? 'D' : '');
  };
  async function settle(maxMs = 2000) {
    let last = Date.now(); const start = last;
    const mo = new MutationObserver(ms => { if (ms.some(m => !(m.target.closest && m.target.closest('#__ai_dlg, #__ai_bar')))) last = Date.now(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    while (Date.now() - last < 700 && Date.now() - start < maxMs) await sleep(120);
    mo.disconnect();
  }

  // इंसान का काम (password, CV upload, captcha, OTP): पट्टी दिखाकर इंतज़ार
  async function waitForUser(msg, cond) {
    log('⏸', msg);
    const fp0 = fingerprint(); let manual = false, since = 0, lastSnap = '';
    setBar('⏸ ' + msg, { label: '✅ हो गया, आगे बढ़ो', onClick: () => { manual = true; } });
    const t0 = Date.now();
    while (Date.now() - t0 < 15 * 60 * 1000 && !window.__aiStop) {
      await sleep(600);
      if (manual) break;
      let fp; try { fp = fingerprint(); } catch (e) { fp = fp0; }
      if (fp !== fp0) break;
      let ok = false; try { ok = !!(cond && cond()); } catch (e) {}
      if (ok) {
        const snap = visiblePw().map(p => p.value).join('|') + '#' + queryAll('input[type=file]').map(f => f.files.length).join(',');
        if (snap !== lastSnap) { lastSnap = snap; since = Date.now(); }
        else if (Date.now() - since > 2500) break;
      } else lastSnap = '';
    }
    setBar(null);
  }

  // ================= क्रियाएँ (हाथ) =================
  function fillPasswords() {
    const pw = visiblePw().filter(p => !p.value);
    pw.forEach(p => { p.scrollIntoView({ block: 'center' }); p.focus(); setVal(p, PASSWORD); });
    return pw.length;
  }
  // ================= Resume फ़ाइल: एक बार चुनो, फिर स्क्रिप्ट हर साइट पर खुद अपलोड करती है =================
  let RESUME_FILE = null, UPLOAD_N = 0, UPLOAD_ERR = '';
  const UPLOADED = new WeakSet();
  const SKIP_FILE = /cover|photo|picture|portrait|passport|certificate|transcript|id proof|signature|salary slip|reference/i;
  const resumeStatus = () => !RESUME_FILE ? 'not selected by the candidate: use do=human for CV upload'
    : 'selected (' + RESUME_FILE.name + '); the script attaches it to resume fields automatically; attached so far: ' + UPLOAD_N + ' field(s)' + (UPLOAD_ERR ? '; last upload error: ' + UPLOAD_ERR : '');
  function pickResume() {
    return new Promise(resolve => {
      document.getElementById('__ai_dlg')?.remove();
      const wrap = document.createElement('div'); wrap.id = '__ai_dlg';
      Object.assign(wrap.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.45)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' });
      const box = document.createElement('div');
      Object.assign(box.style, { background: '#fff', color: '#111', padding: '22px', borderRadius: '14px', width: 'min(520px,92vw)', fontFamily: 'system-ui,sans-serif', fontSize: '16px', boxShadow: '0 10px 40px rgba(0,0,0,.4)' });
      const t = document.createElement('div'); t.textContent = '📄 अपना Resume (PDF) चुनो। बस एक बार, फिर स्क्रिप्ट हर फॉर्म में खुद अपलोड करेगी।'; t.style.marginBottom = '12px';
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,.doc,.docx';
      const skip = document.createElement('button'); skip.type = 'button'; skip.textContent = 'Skip (मैं खुद अपलोड करूँगा)'; skip.style.cssText = 'display:block;margin-top:14px;padding:8px 14px;cursor:pointer;';
      box.append(t, inp, skip); wrap.appendChild(box); document.body.appendChild(wrap);
      const done = f => { wrap.remove(); resolve(f); };
      inp.onchange = () => done(inp.files[0] || null);
      skip.onclick = () => done(null);
    });
  }
  const fileToB64 = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1] || ''); fr.onerror = () => r(''); fr.readAsDataURL(f); });
  const b64ToFile = (b, name, type) => { const bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new File([a], name || 'resume.pdf', { type: type || 'application/pdf' }); };
  const busyNow = () => queryAll('[aria-busy=true],[role=progressbar],[class*=spinner],[class*=Spinner],[class*=loading],[class*=Loading]').some(e => visible(e) && !inUI(e) && !/^(BODY|HTML)$/.test(e.tagName));
  const UPTRY = new WeakMap();
  async function autoUpload(force) {
    if (!RESUME_FILE || (!force && busyNow())) return 0;
    let n = 0;
    for (const inp of deepAll('input[type=file]')) {
      if (inUI(inp) || inp.disabled || inp.files.length || UPLOADED.has(inp)) continue;
      const lab = labelText(inp) + ' ' + (inp.getAttribute('data-automation-id') || '') + ' ' + (inp.name || '');
      if (SKIP_FILE.test(lab)) continue;
      const tries = (UPTRY.get(inp) || 0) + 1; if (tries > 3) continue; UPTRY.set(inp, tries);
      try {
        const t0 = Date.now(), W = winOf(inp), dt = new W.DataTransfer();
        dt.items.add(new W.File([RESUME_FILE], RESUME_FILE.name, { type: RESUME_FILE.type || 'application/pdf' }));
        inp.files = dt.files;
        ['input', 'change'].forEach(e => inp.dispatchEvent(new W.Event(e, { bubbles: true })));
        await sleep(2200);
        const bad = NETERR.filter(e => e.t >= t0 && /attachment|upload|resume/i.test(e.m));
        if (bad.length) { UPLOAD_ERR = 'upload request failed: ' + bad[bad.length - 1].m; try { inp.value = ''; } catch (e) {} log('❌ resume upload फेल, बाद में दोबारा कोशिश होगी:', UPLOAD_ERR); }
        else { UPLOADED.add(inp); n++; UPLOAD_N++; UPLOAD_ERR = ''; log('📄 resume attach हुआ:', RESUME_FILE.name); }
      } catch (e) { UPLOAD_ERR = e.message; log('❌ resume upload error:', e.message); }
    }
    return n;
  }

  const fire = el => { const W = winOf(el); ['keydown', 'input', 'change', 'keyup', 'blur'].forEach(n => el.dispatchEvent(new W.Event(n, { bubbles: true }))); };
  const setVal = (el, v) => {
    const W = winOf(el);
    if (!/^(INPUT|TEXTAREA)$/.test(el.tagName)) {          // contenteditable / spinbutton जैसे फील्ड
      el.focus();
      if (el.isContentEditable) { const sel = W.getSelection(), rg = el.ownerDocument.createRange(); rg.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rg); }
      for (const ch of String(v)) {
        el.dispatchEvent(new W.KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
        if (!(el.isContentEditable && el.ownerDocument.execCommand('insertText', false, ch))) el.textContent = (el.textContent || '') + ch;
        el.dispatchEvent(new W.KeyboardEvent('keyup', { key: ch, bubbles: true }));
      }
      fire(el); return;
    }
    const proto = el.tagName === 'TEXTAREA' ? W.HTMLTextAreaElement.prototype : W.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
    fire(el);
  };
  const key = (el, k) => { const W = winOf(el); ['keydown', 'keyup'].forEach(n => el.dispatchEvent(new W.KeyboardEvent(n, { key: k, code: k, bubbles: true, cancelable: true }))); };
  const realClick = el => {
    const W = winOf(el);
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(n => {
      const E = n.startsWith('pointer') && W.PointerEvent ? W.PointerEvent : W.MouseEvent;
      el.dispatchEvent(new E(n, { bubbles: true, cancelable: true, view: W }));
    });
  };
  const match = (list, v, get) => {
    v = low(v);
    return list.find(o => low(get(o)) === v) || list.find(o => low(get(o)).includes(v)) ||
           list.find(o => low(get(o)).length > 1 && v.includes(low(get(o))));
  };

  // ================= आँखें: पेज की नंबर वाली सूची =================
  const INTERACTIVE = 'input, textarea, select, button, a[href], [role=button], [role=link], [role=combobox], [role=option], [role=menuitem], [role=checkbox], [role=radio], [role=tab], [role=switch], [aria-haspopup], [role=spinbutton], [contenteditable=true], .ui-menu-item, .select2-results__option';
  const OPTLIKE = '[role=option],[role=menuitem],.ui-menu-item,.select2-results__option';
  let ELS = [];
  function observe() {
    const dlg = findDialog();
    const out = []; ELS = []; const seen = new Set();
    for (const el of deepAll(INTERACTIVE)) {
      if (out.length >= 150) break;
      if (seen.has(el) || inUI(el)) continue; seen.add(el);
      const tag = el.tagName.toLowerCase(), type = (el.type || '').toLowerCase(), role = el.getAttribute('role') || '';
      if (tag === 'input' && type === 'hidden') continue;
      const choice = type === 'checkbox' || type === 'radio' || role === 'checkbox' || role === 'radio' || role === 'switch';
      let target = el;
      if (choice && tag === 'input' && (!visible(el) || tiny(el))) target = el.labels?.[0] || el.closest('label');
      if (!target || !visible(target)) continue;
      if (!choice && tiny(el)) continue;
      const isOpt = el.matches(OPTLIKE);
      if (dlg && !dlg.contains(el) && !isOpt) continue;
      if (el.getAttribute('aria-hidden') === 'true' && !isOpt) continue;
      let e;
      if (tag === 'input' && type === 'file') e = { kind: 'file', label: labelText(el) };
      else if (type === 'password') e = { kind: 'password', label: labelText(el), filled: !!el.value };
      else if (tag === 'select') e = { kind: 'select', label: labelText(el), value: clean(el.options[el.selectedIndex]?.text), options: [...el.options].map(o => clean(o.text)).slice(0, 80) };
      else if (choice) {
        const checked = !!(el.checked || el.getAttribute('aria-checked') === 'true');
        e = (type === 'radio' || role === 'radio') ? { kind: 'radio', group: groupLabel(el), option: optLabel(el), checked }
                                                    : { kind: 'checkbox', label: (optLabel(el) + ' | ' + labelText(el)).slice(0, 220), checked };
      }
      else if (tag === 'textarea' || (tag === 'input' && !['button', 'submit', 'reset', 'image'].includes(type)))
        e = { kind: (role === 'combobox' || el.hasAttribute('aria-autocomplete') || el.hasAttribute('list')) ? 'autocomplete-input' : (type || 'text'), label: labelText(el), value: el.value };
      else if (role === 'spinbutton' || el.isContentEditable) e = { kind: 'spinbutton', label: labelText(el), value: clean(el.textContent).slice(0, 20) };
      else if (role === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox') e = { kind: 'dropdown', label: labelText(el), value: clean(el.textContent).slice(0, 60) };
      else if (isOpt) { e = { kind: 'option', text: clean(el.innerText || el.textContent).slice(0, 80) }; if (!e.text) continue; }
      else if (tag === 'a' && role !== 'button') { e = { kind: 'link', text: btnText(el) }; if (!e.text) continue; }
      else { e = { kind: role === 'tab' ? 'tab' : 'button', text: btnText(el) }; if (!e.text) continue; }
      if (el.required || el.getAttribute('aria-required') === 'true' || /\*/.test(e.label || '')) e.required = true;
      if (e.required && ['dropdown', 'select', 'autocomplete-input', 'text', 'email', 'tel', 'date', 'number', 'spinbutton'].includes(e.kind)) {
        const v = clean(e.value || ''); if (!v || /^(select|not selected|select one|please select)\W*$/i.test(v)) e.empty = true;
      }
      if (el.getAttribute('aria-invalid') === 'true') e.invalid = true;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') e.disabled = true;
      e.i = out.length; ELS.push({ el, target, e }); out.push(e);
    }
    const hash = location.href + '|' + out.map(e => e.kind + (e.label || e.text || e.group || '') + (e.option || '')).join('~');
    return { out, hash, dlgText: dlg ? clean(dlg.innerText).slice(0, 1800) : '' };
  }

  const BLOCK = /submit|finish|send application|complete application|confirm and apply/i;

  async function act(a) {
    const it = a.i !== undefined && a.i !== null ? ELS[a.i] : null;
    const el = it?.el;
    const need = () => { if (!it) throw new Error('bad element index ' + a.i); };
    switch (a.do) {
      case 'type': {
        need();
        if (it.e.kind === 'password') return { r: 'blocked: use do=password for password fields' };
        if (it.e.kind === 'file') return { r: 'blocked: file upload is for the human (use do=human)' };
        if (!/^(INPUT|TEXTAREA)$/.test(el.tagName) && !el.isContentEditable && el.getAttribute('role') !== 'spinbutton') return { r: 'error: this is a ' + it.e.kind + ', not a typeable field; use click or choose' };
        el.scrollIntoView({ block: 'center' }); el.focus && el.focus();
        setVal(el, a.value ?? '');
        if (it.e.kind === 'autocomplete-input') key(el, 'ArrowDown');
        if (a.enter) key(el, 'Enter');
        return { r: 'ok' };
      }
      case 'select': {
        need();
        if (el.tagName !== 'SELECT') return { r: 'error: not a native select; click it, then click an option' };
        const o = match([...el.options], a.value, x => x.text);
        if (!o) return { r: 'error: option not found; options are ' + [...el.options].map(x => clean(x.text)).slice(0, 25).join(' / ') };
        el.value = o.value; fire(el); return { r: 'ok' };
      }
      case 'choose': {
        need();
        const OPTS = OPTLIKE + ', [role=listbox] li, [role=listbox] > div, ul[role=listbox] > *, [class*=listbox] li, [class*=dropdown] li, [class*=popup] li, li[class*=option], [class*=dropdown] [class*=option]';
        const getOpts = () => deepAll(OPTS).filter(o => visible(o) && !inUI(o) && !o.contains(el) && clean(o.innerText || o.textContent).length <= 80);
        const textOf = x => clean(x.innerText || x.textContent);
        el.scrollIntoView({ block: 'center' }); await sleep(100);
        if (!getOpts().length) it.target.click();
        let o, opts = [];
        for (let k = 0; k < 8 && !o; k++) {
          await sleep(350); opts = getOpts();
          if (opts.length) o = match(opts, a.value, textOf);
          if (!o && !opts.length && k === 3) { realClick(el); key(el, 'ArrowDown'); }
        }
        if (!o) {   // अनजान markup: dropdown के पास वही exact text वाला हिस्सा ढूँढो और क्लिक करो
          const er = el.getBoundingClientRect();
          o = deepAll('li,[role=listitem],[class*=item],[class*=Item],[class*=option],[class*=Option],div,span,p,a').find(x => visible(x) && !inUI(x) && !el.contains(x) && !x.contains(el) && x.children.length <= 2 && low(textOf(x)) === low(a.value) && (Math.abs(x.getBoundingClientRect().top - er.bottom) < 450 || Math.abs(x.getBoundingClientRect().bottom - er.top) < 450));
        }
        if (!o) {   // सूची नहीं मिली: field में टाइप करके Enter दबाओ
          const inp = el.matches('input,textarea') ? el : (el.querySelector('input') || el.closest('[role=combobox]')?.querySelector('input'));
          if (inp) {
            inp.focus(); setVal(inp, a.value); key(inp, 'ArrowDown'); await sleep(900);
            opts = getOpts(); o = opts.length ? match(opts, a.value, textOf) : null;
            if (!o) { key(inp, 'Enter'); await sleep(600); if (low(inp.value).includes(low(a.value)) || low(textOf(el)).includes(low(a.value))) return { r: 'UNVERIFIED: typed "' + a.value + '" and pressed Enter, but this form needs the option CLICKED from the opened list; the value may not be saved. Open the dropdown and click the option itself.' }; }
          }
        }
        if (!o) return { r: 'error: option "' + a.value + '" not found; the list is left open, options seen: ' + opts.map(textOf).slice(0, 20).join(' / ') };
        realClick(o); await sleep(450);
        const ok = () => !getOpts().includes(o) || low(textOf(el)).includes(low(a.value));
        if (!ok()) { o.click(); await sleep(350); const inner = o.querySelector('input,label'); if (!ok() && inner) { inner.click(); await sleep(300); } }
        return { r: 'ok (picked: ' + textOf(o) + ')' };
      }
      case 'check': {
        need();
        const want = !(a.value === false || String(a.value).toLowerCase() === 'false');
        const cur = !!(el.checked || el.getAttribute('aria-checked') === 'true');
        if (cur !== want) { it.target.scrollIntoView({ block: 'center' }); it.target.click(); await sleep(150); if (el.checked !== undefined && el.checked !== want && it.target !== el) el.click(); }
        return { r: 'ok' };
      }
      case 'click': {
        need();
        const text = it.e.text || it.e.label || it.e.option || '';
        if (!AUTO_SUBMIT && ['button', 'link'].includes(it.e.kind) && BLOCK.test(text)) return { r: 'blocked', stop: 'final', msg: `अब "${text}" बटन बचा है। सब एक बार खुद पढ़ लो और उसे तुम खुद दबाओ। Submit मैं नहीं दबाता।` };
        const isDis = () => el.disabled || el.getAttribute('aria-disabled') === 'true';
        if (isDis()) { for (let k = 0; k < 10 && isDis(); k++) await sleep(300); }   // पेज को enable होने का समय दो
        if (isDis()) return { r: 'error: that element is still disabled: a required field above is probably empty or invalid; fix it first' };
        it.target.scrollIntoView({ block: 'center' }); await sleep(150);
        if (it.e.kind === 'option') realClick(it.target); else it.target.click();
        return { r: 'ok', clicked: true };
      }
      case 'scroll': {
        if (it) scrollAll(el); else { const d = findDialog(); if (d) scrollAll(d); else window.scrollBy(0, 700); }
        return { r: 'ok' };
      }
      case 'wait': await sleep(Math.min(a.ms || 1500, 5000)); return { r: 'ok' };
      case 'ask': {
        const ans = await dialog({ kind: 'ask', title: '🤖 एक ज़रूरी जानकारी चाहिए', text: a.question || 'जानकारी चाहिए', input: true, mic: true, skipLabel: 'Skip' });
        if (ans) { MEMO.push({ question: a.question, answer: ans }); return { r: 'candidate answered: ' + ans }; }
        return { r: 'candidate skipped' };
      }
      case 'upload': {
        const k = await autoUpload(true);
        return { r: k ? 'ok: resume attached to ' + k + ' field(s)' : (RESUME_FILE ? 'no empty resume field found, or upload failed: ' + (UPLOAD_ERR || 'none') : 'no resume file was selected; use do=human') };
      }
      case 'password': {
        const n = PASSWORD ? fillPasswords() : 0;
        return { r: n ? 'ok: the script typed the stored password into ' + n + ' field(s)' : 'no empty password field visible (or no stored password)' };
      }
      case 'human': {
        let typed = 0;
        if (PASSWORD && emptyPwd() > 0) { typed = fillPasswords(); await sleep(400); }
        const pe0 = emptyPwd(), f0 = emptyFiles();
        if (typed && !f0 && !/captcha|otp|verif|code/i.test(a.msg || '')) return { r: 'ok: password typed by the script' };
        await waitForUser(a.msg || 'यहाँ तुम्हारा कुछ करना ज़रूरी है। हो जाए तो आगे बढ़ो दबाओ।',
          () => (pe0 > 0 || f0 > 0) && emptyPwd() === 0 && (f0 === 0 || emptyFiles() < f0));
        return { r: 'human finished' };
      }
      case 'final': if (hasIssues()) return { r: 'error: the page still shows issues / Fields to fix. Click Go to Next Issue and fix them first.' }; return { r: 'ok', stop: 'final', msg: `यह आख़िरी Review पेज है${a.msg ? ' (' + a.msg + ')' : ''}। सब एक बार खुद पढ़ लो और Submit खुद दबाओ। Submit मैं नहीं दबाता।` };
      case 'done': return { r: 'ok', stop: 'done', msg: 'हो गया' + (a.msg ? ': ' + a.msg : '') + '।' };
      default: return { r: 'error: unknown action ' + a.do };
    }
  }

  // ================= दिमाग: Gemini के निर्देश =================
  const SYSTEM = `You are an autonomous agent that completes job applications on ANY careers/ATS website (Workday, SuccessFactors, Greenhouse, Lever, iCIMS, Taleo, Oracle, custom portals...) inside the candidate's own browser. Each turn you receive the candidate's RESUME and PROFILE, the current page text, visible ERRORS, your HISTORY, and a numbered list of interactive ELEMENTS. Element numbers are valid only for the current turn. Every site is different: read the page, work out what it wants and where "continue" is, and adapt. Never assume a layout.
You have NO tools. Never write <invoke>, <parameter> or any XML tag. Your whole reply is exactly one JSON object that starts with { and nothing else.
Output ONLY JSON:
{"thought":"max 20 words, plain text, no explanations","actions":[...],"note":"optional: a reusable tip about THIS website (max 200 chars), only if you learned something non-obvious"}
ACTIONS (executed in order; after the first click the rest are dropped because the page changes, so put the click LAST):
{"do":"type","i":N,"value":"text"}  - text/textarea/email/tel/date fields and autocomplete inputs ("enter":true presses Enter)
{"do":"select","i":N,"value":"exact option text"}  - native select only
{"do":"check","i":N,"value":true|false}  - checkbox / radio / switch
{"do":"click","i":N}  - button, link, tab, option
{"do":"choose","i":N,"value":"option text"}  - custom dropdown: the script opens it and clicks the option itself, in ONE action. If the option text is not found the list stays open and the error shows the real options; then click the right option next turn
{"do":"scroll","i":N}  - scroll an element (or omit i to scroll the open popup/page); needed when a popup's Accept button stays disabled until the text is scrolled to the end
{"do":"wait"}  - let the page load
{"do":"ask","question":"short Hindi/Hinglish question"}  - ask the candidate a missing personal fact; the answer comes back in the next HISTORY
{"do":"password"}  - the script types the candidate's stored password into every empty visible password field (you never see the password). Use it for sign-in, create-account and verify/retype-password fields
{"do":"upload"}  - attach the pre-selected resume file to every empty resume upload field (the script also does this automatically at the start of every turn, so you rarely need it)
{"do":"human","msg":"short Hindi/Hinglish line"}  - pause for things only the human can do: CAPTCHA, OTP/email verification code, or a CV upload that failed
{"do":"final","msg":"short"}  - this is the last review/submit page. Do NOT click the final submit button.
{"do":"done","msg":"short"}  - application already submitted or nothing left to do
HOW TO WORK
- Fill every visible empty field you can in ONE turn, then click the continue/next/save/apply/create-account button as the last action. Do not click Next while required fields are still empty.
- Custom dropdown (kind dropdown): use do=choose (one action, many dropdowns per turn are fine). Autocomplete input: type a short value (e.g. the city name), next turn click the suggestion.
- A link like "Read and accept the data privacy statement" opens a popup: click it, next turn the popup's elements are the only ones listed; scroll it if needed, then click its Accept/Agree/OK button (never Decline/Cancel). Tick standard privacy/terms checkboxes.
- When a DIALOG is open, only its elements are listed. Deal with it first.
- If the page did not change after your last click, read ERRORS and HISTORY: fix the invalid fields, accept the missing consent, or try another element. If you are repeating yourself, change approach or ask the human. Never loop.
- Password fields: use do=password (then click the continue/sign-in button). File uploads (CV): the script attaches the resume by itself (see RESUME FILE); use do=upload if a resume field is still empty, and do=human for the CV only if RESUME FILE says it is not selected or an upload error shows. CAPTCHA/OTP: do=human.
- If an account must be created or signed in, use the PROFILE email and do=password for the password fields.
- If the page says an email was sent / "verify your account" / "account already exists", the account ALREADY exists: never click Create Account again. The candidate verifies the email (the script pauses for this), then sign in with the PROFILE email and do=password. If Sign In shows invalid credentials after verification, use do=human once instead of looping between Sign In and Create Account.
DATA RULES
- Never invent facts about the candidate. Use RESUME, PROFILE and answers in HISTORY/TOLD.
- ASK RULES: anything already in TOLD BY CANDIDATE must be used, never asked again. When several facts are missing (address line, pincode, Class XII school/year/percentage...), put them ALL in ONE do=ask with a numbered question, e.g. "1) Address line 1? 2) Pincode? 3) 12th school, year, %?". Before asking, check that RESUME/PROFILE/TOLD really lack it. Use the answer for every later field and every later page.
- Treat CBSE as the Class XII board. If a field wants the school's city/state and it is unknown, use the candidate's answer in TOLD or ask in the same combined question.
- Never guess numbers or identifiers such as a pincode, ID or reference number. If such a field is required and missing, use do=human so the candidate types it.
- Legal/background declarations (misconduct, dismissal, redundancy, criminal record, conflicts of interest, relatives, sponsorship) are facts about the candidate: PROFILE holds his own answers, so answer from PROFILE without asking. If a question is not covered by PROFILE (for example "have you worked for this company before"), use do=ask. Never guess.
- "Have you previously worked for / been employed by this organization?" is answered from RESUME: No unless the resume lists that company. Do not ask the candidate this.
- Education: enter EVERY education item listed in PROFILE (all degrees and certificates such as a bachelor's degree, a professional certificate, Class XII), one entry each, not only the highest degree. If a field of an entry is missing in PROFILE (for example the Class XII board, school, year or percentage), use do=ask once for it. Do not skip the entry and do not invent values.
- On an education/experience page, before clicking Next or Save and continue, make sure EVERY education item from PROFILE exists on the page, including Class XII (use TOLD BY CANDIDATE for its details). Add the missing ones first.
- NETWORK ERRORS: if an upload or a save request failed (400/404/500), that step did NOT really succeed even if the page moved on. Redo it: do=upload again for the resume, or reopen the entry and fix its required fields (for example Degree). Ignore errors that match no visible problem.
- Never use do=human to let the candidate answer questions or pick dropdown values: answer them yourself from PROFILE and RESUME (custom "Select One" dropdowns: use do=choose, many per turn). do=human is only for CAPTCHA, OTP or email verification, or a failed upload.
- Date of birth: check the field format (MM/DD vs DD/MM) before typing: the day, month and year given in PROFILE. For segmented date inputs, type each part separately.
- Ask (do=ask) only when a REQUIRED field needs a personal fact that is truly missing (date of birth, salary, work authorisation, legal declarations). Max 2 asks per turn. Everything else: decide sensibly yourself.
- Never ask about how they heard of the job (use LinkedIn or the closest option such as Job Board/Social Media), title/gender (see PROFILE) or optional fields (leave optional ones empty unless trivial).
- Dates: follow the field's format (type=date -> YYYY-MM-DD; otherwise the format hinted by label/placeholder). Phone: digits only without country code unless the label asks; country dropdown: India (+91).
- Experience/education entries come from the resume. Free-text questions: short, honest, English, from the resume.
- Voluntary/EEO/diversity: use PROFILE if given, otherwise "prefer not to say / decline".
- Select/radio values must match the listed options exactly.
- START DATES of education entries are optional on most forms: leave them empty unless the field is marked required. If one is required and missing, include it in ONE combined do=ask.
- EXACT VALUES: type PROFILE values exactly as written. Never add or embellish words (no "House No.", "Sector", etc.). Never invent a month, date, language proficiency, grade or any other value that PROFILE/RESUME/TOLD does not give. If a required field needs such a value and it is missing, do ONE combined do=ask listing everything missing (for example the passing months of every education entry, the proficiency level of every language), then reuse the answer everywhere.
- Required address fields (Address Line 1, City, State, Pin Code) must be filled from PROFILE before clicking Next on a personal-info page. Never skip them.
- Do not tick "Graduated"/"Completed degree" for professional-exam or school-level entries unless the form has no other way to save them.
- RESUME-PARSED JUNK: after the resume upload the site auto-creates entries (Unnamed Job Title, Unnamed Licenses, Languages, Skills...). On an education/experience page check EVERY section down to the bottom, including Languages and Skills. Delete garbage entries (Unnamed License...). Fix incomplete ones: an "Unnamed Job Title" experience gets its real title from RESUME, a language needs its proficiency level, an education entry needs its Degree. Do not click Next while any entry shows "Fields to fix" or a red error.
- PINCODE / POSTAL CODE: use the pincode from PROFILE. Such fields are often searchable dropdowns: use do=choose with the digits (or type the digits, then click the suggestion). If it says "No results were found", the pincode in PROFILE is wrong: do=ask once, never do=human.
- ISSUES BANNER: if the page shows "N issues that need to be fixed", "Go to Next Issue" or red field errors after a Submit attempt, click "Go to Next Issue" (or the issue link), fix that field from PROFILE/RESUME/TOLD, and repeat until none are left. Never output do=final while such a banner or errors are visible.
- PREFILLED VALUES ARE OFTEN WRONG: sites auto-fill fields from the uploaded resume (e.g. City = the state name, or Street Address = the city name). Do NOT assume a non-empty field is correct. For every field that PROFILE covers (name, email, phone, address line 1, city, state, pincode, country), compare the current value with PROFILE and, if different, overwrite it with do=type (for typed fields) or do=choose (for dropdowns). Address line 1 must be EXACTLY the text in PROFILE. City must be the CITY from PROFILE (never a state name). State/Province is a dropdown: choose the state from PROFILE. Pincode must match PROFILE. Do this BEFORE clicking Next on the personal-info page.
- NEXT IS DISABLED: read EMPTY REQUIRED FIELDS in the prompt and fix exactly those, one by one. Never click the same element twice in a row. A dropdown that already shows a real value (Yes/No/Career Fair...) is NOT empty; do not touch it unless PROFILE says the value is wrong.
- HOW DID YOU HEAR ABOUT US: choose the option closest to LinkedIn (Job Board / Social Media / LinkedIn). If a follow-up "If Other Website / Job Portal, please select which one" exists, choose LinkedIn there (or Other if LinkedIn is not listed), never N/A. Fix wrong earlier values like Career Fair.
- SIGNATURE / DATE FIELDS: a typed signature is the candidate's full name; a signature or application date is TODAY from the prompt (never an older date like 2025). Use the field's own date format.
- Field labels: a field's own label (kind/label in ELEMENTS) decides what goes in it. Never put a state name in a City field or a city in a State field.
- DATES: never invent a date. A signature date / date of application is TODAY'S DATE (given in the prompt). For date-picker inputs type the date in the format shown on the page and set "enter":true.
- DROPDOWNS are committed only by CLICKING the option in the opened list (do=choose does that). A result starting with UNVERIFIED means the value was NOT saved: try again, or click the option element directly. If a dropdown shows a wrong value, choose the right one again.
- "How did you hear about us": choose LinkedIn if it is an option; otherwise choose "Other Website / Job Portal" (or the closest Job Board / Social Media option) and then LinkedIn in the follow-up "which one" dropdown (if LinkedIn is missing there, pick Other and type LinkedIn in "please name website"). Never choose Career Fair, Community Organization, Referral or Agency.
- A dropdown whose value is already shown (e.g. "No", "Yes", a name) is FILLED: do not click its options again. If NEXT IS DISABLED, use the DIAGNOSIS line: it lists the required fields that are still empty or invalid.`;

  const STATIC = SYSTEM + `\n\nCANDIDATE RESUME:\n${RESUME}\n\nPROFILE:\n${PROFILE}`;

  // ================= मुख्य चक्र =================
  try {
    const rb = SS.get('resumeB64');
    if (rb) RESUME_FILE = b64ToFile(rb, SS.get('resumeName'), SS.get('resumeType'));
    else if (SS.get('resumeSkip') !== '1') {
      RESUME_FILE = await pickResume();
      if (RESUME_FILE) {
        const b64 = await fileToB64(RESUME_FILE);
        if (b64 && b64.length < 3500000) { SS.set('resumeB64', b64); SS.set('resumeName', RESUME_FILE.name); SS.set('resumeType', RESUME_FILE.type || 'application/pdf'); }
      } else SS.set('resumeSkip', '1');
    }
  } catch (e) { log('resume की याददाश्त में दिक्कत', e.message); }
  let verifyShown = !!RUN.verifyShown, finalMsg = '', history = RUN.history || [], lastHash = '', noChange = 0, hashBefore = '';
  let lastNetT = 0, finalWaits = 0;
  const hasIssues = () => /issues? that need to be fixed|Go to Next Issue|Fields to fix|fix the following/i.test(allDocs().map(d => d.body?.innerText || '').join(' '));
  const saveRun = turn => SS.set('run', JSON.stringify({ ts: Date.now(), turns: turn, memo: MEMO, usage: USAGE, history: history.slice(-3), verifyShown }));
  try {
    for (let turn = (RUN.turns || 0) + 1; turn <= MAX_TURNS && !window.__aiStop; turn++) {
      await sleep(400); await settle();
      if (RESUME_FILE && (await autoUpload())) await settle();
      const obs = observe();
      const nextBtn = ELS.find(x => ['button', 'link'].includes(x.e.kind) && /^(next|continue|save and continue)/i.test(x.e.text || ''));
      let diag = '';
      if (nextBtn && nextBtn.e.disabled) {
        const missing = ELS.filter(x => !x.e.disabled && (x.e.required || /\*/.test(x.e.label || '')) && ['text', 'email', 'tel', 'number', 'date', 'textarea', 'dropdown', 'select', 'autocomplete-input'].includes(x.e.kind) && /^(select|not selected)?$/i.test(clean(x.e.value || ''))).map(x => x.e.label);
        const invalid = ELS.filter(x => x.e.invalid).map(x => x.e.label);
        diag = 'The Next button is DISABLED. Required fields still empty: ' + JSON.stringify(missing) + '. Fields marked invalid: ' + JSON.stringify(invalid) + '. Fix exactly these (also re-check dates and dependent dropdowns); do not click the same suggestion again and again.';
        log('🩺', diag);
      }
      if (history.length) history[history.length - 1].page_changed = obs.hash !== hashBefore;
      noChange = (obs.hash === lastHash) ? noChange + 1 : 0; lastHash = obs.hash;
      log(`\n===== टर्न ${turn}: ${document.title} (${obs.out.length} elements) =====`);

      if (!verifyShown && /verify your account|verification (e-?mail|link)|email has been sent|check your (e-?mail|inbox)/i.test(pageText())) {
        verifyShown = true; saveRun(turn - 1);
        await waitForUser('इस साइट ने verification email भेजा है। Gmail खोलकर उस mail (Spam भी देखो) का verify link दबाओ, फिर यहाँ आकर "हो गया" दबाओ। उसके बाद मैं Sign In करूँगा।', () => false);
        noChange = 0; continue;
      }
      if (noChange >= 4) {
        const errs = getErrors().concat(obs.out.filter(e => e.empty).map(e => 'खाली ज़रूरी फील्ड: ' + (e.label || '').slice(0, 60)));
        await waitForUser('यहाँ आगे नहीं बढ़ पा रहा।' + (errs.length ? ' पेज की error: ' + errs.join(' | ') : '') + ' इसे खुद ठीक करो या आगे बढ़ाओ, फिर "हो गया" दबाओ।', () => false);
        noChange = 0; continue;
      }
      const warn = noChange >= 2 ? `\n\nWARNING: the page has not changed for ${noChange} turns despite your actions. Do something different (check ERRORS, open consent/privacy popups, scroll a popup, pick an option from an opened list) or ask the human.` : '';
      const newNet = NETERR.filter(e => e.t > lastNetT).map(e => e.m).slice(-6); lastNetT = Date.now();
      const notes = loadNotes();
      const emptyReq = obs.out.filter(e => e.empty).map(e => '#' + e.i + ' ' + (e.label || '').slice(0, 90));
      const nb = obs.out.find(e => e.kind === 'button' && /^(next|continue|save and continue|next step)$/i.test(e.text || ''));
      const nd = new Date(), M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const pad = n => String(n).padStart(2, '0');
      const extra = 'TODAY: ' + M[nd.getMonth()] + ' ' + nd.getDate() + ', ' + nd.getFullYear() + ' (DD/MM/YYYY ' + pad(nd.getDate()) + '/' + pad(nd.getMonth() + 1) + '/' + nd.getFullYear() + '; YYYY-MM-DD ' + nd.getFullYear() + '-' + pad(nd.getMonth() + 1) + '-' + pad(nd.getDate()) + ')\n' +
        'EMPTY REQUIRED FIELDS (fix THESE first; they are why Next is disabled): ' + (emptyReq.length ? JSON.stringify(emptyReq) : 'none detected') + '\n' +
        'NEXT/CONTINUE BUTTON: ' + (nb ? (nb.disabled ? 'DISABLED' : 'enabled') : 'not listed');
      const user = `SITE NOTES (learned earlier on this website):\n${notes.length ? notes.map(n => '- ' + n).join('\n') : '(none)'}\n\nTOLD BY CANDIDATE (spoken, earlier):\n${JSON.stringify(MEMO)}\n\nRESUME FILE: ${resumeStatus()}\n\nPAGE: ${document.title} | ${location.href}\n` +
        (obs.dlgText ? `A POPUP/DIALOG IS OPEN. Its text: ${obs.dlgText}\n` : '') +
        `PAGE TEXT: ${pageText()}\n\n${extra}\n\nERRORS VISIBLE ON PAGE: ${JSON.stringify(getErrors())}\n\nNETWORK ERRORS SINCE LAST TURN (HTTP 400+; many are harmless site noise, act only if they match a visible problem such as a failed upload or a section that did not save): ${JSON.stringify(newNet)}\n\nHISTORY (your recent turns, oldest first):\n${JSON.stringify(history.slice(-3))}${warn}\n\nDIAGNOSIS: ${diag || 'none'}\n\nTODAY'S DATE: ${TODAY}\n\nELEMENTS:\n${obs.out.map(e => JSON.stringify(e)).join('\n')}\n\nReply now with ONE JSON object only (it starts with {). No XML, no <invoke> tags.`;

      setBar('🤖 पेज पढ़ रहा हूँ और सोच रहा हूँ... (टर्न ' + turn + ')', stopBtn);
      const plan = await callGeminiJSON(STATIC, user);
      setBar(null);
      log('🤖', plan.thought, plan.actions);
      if (plan.note) { saveNote(plan.note); log('📝 सीखा:', plan.note); }

      hashBefore = obs.hash;
      const results = []; let stop = null;
      setBar('✍️ कर रहा हूँ... (टर्न ' + turn + ')', stopBtn);
      for (const a of (plan.actions || [])) {
        if (window.__aiStop) break;
        let res;
        try { res = await act(a); } catch (e) { res = { r: 'error: ' + e.message }; }
        results.push({ do: a.do, i: a.i, value: a.value, result: res.r });
        log('   •', a.do, a.i ?? '', a.value ?? '', '→', res.r);
        if (res.stop) { stop = res; break; }
        if (res.clicked) break;
        await sleep(180);
      }
      setBar(null);
      history.push({ turn, thought: plan.thought, results });
      saveRun(turn);
      if (stop) {
        if (stop.stop === 'final' && finalWaits < 8) {
          finalWaits++;
          await waitForUser(stop.msg + ' (Submit दबाने के बाद पेज कोई issue दिखाए तो मैं खुद ठीक करूँगा। सब हो जाए तो ⛔ रोको दबा दो।)', () => hasIssues());
          noChange = 0; continue;
        }
        finalMsg = stop.msg; break;
      }
      if (!plan.actions?.length) { await sleep(1200); }
      if (turn === MAX_TURNS) finalMsg = 'अधिकतम टर्न हो गए, यहाँ रुक गया।';
    }
    if (window.__aiStop) finalMsg = 'तुमने रोक दिया।';
  } catch (e) {
    console.error('❌ गड़बड़:', e);
    finalMsg = 'Error आया: ' + e.message + '\n(Console का screenshot भेज देना)';
  }
  setBar(null);
  ['gkey', 'gmodel', 'key', 'run', 'resumeB64', 'resumeName', 'resumeType', 'resumeSkip'].forEach(SS.del);
  log('🏁', finalMsg);
  if (MEMO.length) log('🧾 तुमने ये बताया था (अगली बार से पूछना बंद करने के लिए PROFILE में जोड़ दो / मुझे भेज दो):\n' + MEMO.map(m => '- ' + m.question + ' → ' + m.answer).join('\n'));
  const usageLine = `\n\n💰 इस रन में कुल: ${USAGE.calls} कॉल, नया input ${USAGE.in}, cache से ${USAGE.cacheRead}, cache लिखा ${USAGE.cacheWrite}, output ${USAGE.out} टोकन`;
  log(usageLine);
  await dialog({ kind: 'info', title: '🏁 रुक गया', text: (finalMsg || 'हो गया।') + usageLine });
  window.__aiFillRunning = false;
})();
