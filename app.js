/* ============================================================
   نت‌داکتر — موتور استنتاج + رابط کاربری (Inference Engine & UI)
   استراتژی: استنتاج رو به جلو (Forward Chaining) با انتخاب
   قاعدهٔ برتر بر اساس درصد اطمینان (Confidence)
   ============================================================ */

const $ = s => document.querySelector(s);
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const REPO_URL = 'https://github.com/daniyalbabaei/internet-expert-system';
const PAGES_URL = 'https://daniyalbabaei.github.io/internet-expert-system/';

let answers = {};     /* واقعیت‌های گزارش‌شده توسط کاربر */
let stack = [];       /* ترتیب پاسخ‌ها برای دکمهٔ بازگشت */
const cmdStore = [];  /* دستورات ذخیره‌شده برای دکمهٔ کپی */

/* ---------------- ناوبری ---------------- */
function show(screenId){
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === screenId));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.nav-btn').forEach(b =>
  b.addEventListener('click', () => {
    if (b.dataset.nav === 'home') resetSession();
    show(b.dataset.nav);
  })
);
$('#brandHome').addEventListener('click', () => { resetSession(); show('home'); });
$('#startBtn').addEventListener('click', startQuiz);
$('#backBtn').addEventListener('click', goBack);

function resetSession(){ answers = {}; stack = []; }

function startQuiz(){
  resetSession();
  const q = nextQuestion();
  if (q){ renderQuestion(q); show('quiz'); }
}

/* ---------------- موتور استنتاج ---------------- */

/* حذف پاسخ‌هایی که با جواب‌های جدید دیگر «شرطشان» برقرار نیست */
function cleanStale(){
  let changed = true;
  while (changed){
    changed = false;
    for (const q of QUESTIONS){
      if (q.id in answers && q.cond && !q.cond(answers)){
        delete answers[q.id];
        stack = stack.filter(x => x !== q.id);
        changed = true;
      }
    }
  }
}

function activeQuestions(){
  return QUESTIONS.filter(q => !q.cond || q.cond(answers));
}

function nextQuestion(){
  cleanStale();
  return activeQuestions().find(q => !(q.id in answers)) || null;
}

/* ارزیابی همهٔ قواعد روی واقعیت‌ها و انتخاب قاعدهٔ برتر */
function evaluate(){
  let best = null, second = null;
  for (const r of RULES){
    const ok = Object.entries(r.when).every(([k, v]) => {
      const vals = Array.isArray(v) ? v : [v];
      return answers[k] !== undefined && vals.includes(answers[k]);
    });
    if (!ok) continue;
    if (!best || r.conf > best.conf){ second = best; best = r; }
    else if (!second || r.conf > second.conf){ second = r; }
  }
  return { best, second };
}

/* ---------------- جریان پرسش ---------------- */
function renderQuestion(q){
  const actives = activeQuestions();
  const done = actives.filter(x => x.id in answers).length;
  $('#qCounter').textContent = `سؤال ${fa(done + 1)} از ${fa(actives.length)}`;
  $('#progressBar').style.width = ((done / actives.length) * 100) + '%';

  const card = $('#questionCard');
  card.innerHTML = `
    <h2 class="q-text">${q.text}</h2>
    ${q.hint ? `<p class="q-hint">💡 ${q.hint}</p>` : ''}
    <div class="options">
      ${q.options.map(o => `
        <button class="option ${answers[q.id] === o.value ? 'selected' : ''}" data-v="${o.value}">
          <span class="opt-icon">${o.icon || '•'}</span><span>${o.label}</span>
        </button>`).join('')}
    </div>`;
  card.querySelectorAll('.option').forEach(btn =>
    btn.addEventListener('click', () => selectAnswer(q.id, btn.dataset.v))
  );
}

function selectAnswer(qid, val){
  answers[qid] = val;
  if (!stack.includes(qid)) stack.push(qid);
  const nq = nextQuestion();
  if (nq) renderQuestion(nq);
  else showResult();
}

function goBack(){
  const last = stack.pop();
  if (!last){ show('home'); return; }
  delete answers[last];
  renderQuestion(QUESTIONS.find(x => x.id === last));
}

/* ---------------- صفحهٔ نتیجه ---------------- */
function showResult(){
  const { best, second } = evaluate();
  const d = DIAGNOSES[best.diag];
  const conf = Math.min(best.conf, 97);

  const facts = Object.entries(answers).map(([k, v]) => {
    const q = QUESTIONS.find(x => x.id === k);
    const o = q && q.options.find(o => o.value === v);
    return { q: q ? (q.short || q.text) : k, a: o ? o.label : v };
  });

  const secondD = second && second.conf >= 60 && second.diag !== best.diag ? DIAGNOSES[second.diag] : null;

  $('#resultCard').innerHTML = `
    <div class="glass result">
      <div class="result-top">
        <div class="ring" style="--p:${conf}"><b>${fa(conf)}٪</b><span>اطمینان</span></div>
        <div class="result-title">
          <div class="result-icon">${d.icon}</div>
          <div>
            <h2>${d.title}</h2>
            <p class="muted">تشخیص سیستم خبره بر اساس پاسخ‌های شما • قاعدهٔ فعال: ${best.id}</p>
          </div>
        </div>
      </div>
      <p class="result-desc">${d.desc}</p>
      ${secondD ? `<div class="alt">🤔 احتمال دیگر: <b>${secondD.title}</b> (اطمینان ${fa(second.conf)}٪) — اگر راه‌حل اصلی جواب نداد، سراغ این بروید.</div>` : ''}
      <h3 class="section-title">🛠 راه‌حل گام‌به‌گام</h3>
      <ol class="steps">
        ${d.solutions.map(s => `
          <li>
            <div class="step-text">${s.t}</div>
            ${s.cmd ? `<div class="cmd"><code dir="ltr">${escapeHtml(s.cmd)}</code><button class="copy-btn" data-ci="${cmdStore.push(s.cmd) - 1}">کپی</button></div>` : ''}
          </li>`).join('')}
      </ol>
      <details class="why">
        <summary>🧠 چرا این تشخیص؟ (استدلال سیستم)</summary>
        <div class="why-body">
          <p>${best.why || whyFromRule(best)}</p>
          <h4>واقعیت‌هایی که شما گزارش دادید:</h4>
          <ul class="facts">${facts.map(f => `<li><b>${f.q}:</b> ${f.a}</li>`).join('')}</ul>
          <p class="muted">قاعدهٔ فعال‌شده: <b>اگر</b> ${condText(best.when) || '—'} <b>آنگاه</b> «${d.title}» با اطمینان ${fa(conf)}٪</p>
        </div>
      </details>
      <div class="result-actions">
        <button class="btn-primary" id="againBtn">🔄 شروع دوباره</button>
        <button class="btn-ghost" id="printBtn">🖨 چاپ گزارش</button>
        <button class="btn-ghost" id="kbBtn">📚 پایگاه دانش</button>
      </div>
    </div>`;

  $('#againBtn').addEventListener('click', startQuiz);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#kbBtn').addEventListener('click', () => show('kb'));
  show('result');
}

/* ---------------- متن‌های کمکی ---------------- */
function escapeHtml(s){
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function shortOf(qid){
  const q = QUESTIONS.find(x => x.id === qid);
  return q ? (q.short || q.text) : qid;
}
function valLabel(qid, v){
  const q = QUESTIONS.find(x => x.id === qid);
  if (!q) return String(v);
  const vals = Array.isArray(v) ? v : [v];
  return vals.map(val => {
    const o = q.options.find(o => o.value === val);
    return o ? o.label : val;
  }).join(' یا ');
}
function condText(when){
  return Object.entries(when).map(([k, v]) => `${shortOf(k)} «${valLabel(k, v)}»`).join(' و ');
}
function whyFromRule(rule){
  return `چون ${condText(rule.when)}، این قاعده بیشترین امتیاز اطمینان را بین همهٔ قواعد پایگاه دانش گرفت.`;
}

/* ---------------- پایگاه دانش (نمایش) ---------------- */
function renderKB(){
  $('#statDiag').textContent = fa(Object.keys(DIAGNOSES).length);
  $('#statRules').textContent = fa(RULES.length);
  $('#statQ').textContent = fa(QUESTIONS.length);
  $('#aboutQ').textContent = fa(QUESTIONS.length);
  $('#aboutD').textContent = fa(Object.keys(DIAGNOSES).length);
  $('#aboutR').textContent = fa(RULES.length);

  $('#kbGrid').innerHTML = Object.entries(DIAGNOSES).map(([key, d]) => `
    <details class="kb-card glass">
      <summary>
        <span class="kb-icon">${d.icon}</span>
        <span class="kb-title">${d.title}</span>
        <span class="kb-arrow">▾</span>
      </summary>
      <p>${d.desc}</p>
      <ol class="steps small">
        ${d.solutions.map(s => `
          <li>
            <div>${s.t}</div>
            ${s.cmd ? `<div class="cmd"><code dir="ltr">${escapeHtml(s.cmd)}</code><button class="copy-btn" data-ci="${cmdStore.push(s.cmd) - 1}">کپی</button></div>` : ''}
          </li>`).join('')}
      </ol>
    </details>`).join('');

  $('#rulesList').innerHTML = RULES.map(r => `
    <div class="rule glass">
      <span class="rule-id">${r.id}</span>
      <div class="rule-body"><b>اگر</b> ${condText(r.when) || '(قاعدهٔ پیش‌فرض — همیشه فعال)'} <b>آنگاه</b> «${DIAGNOSES[r.diag].title}»</div>
      <span class="rule-conf">${fa(r.conf)}٪</span>
    </div>`).join('');
}

/* ---------------- کپی و توست ---------------- */
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}
function copyText(text, btn){
  const done = () => {
    toast('✔ کپی شد');
    if (btn){
      const old = btn.textContent;
      btn.textContent = '✔';
      setTimeout(() => btn.textContent = old, 1200);
    }
  };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); done(); }
    catch(e){ toast('❌ کپی نشد — دستی انتخاب کنید'); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  } else fallback();
}
document.addEventListener('click', e => {
  const b = e.target.closest('.copy-btn');
  if (!b) return;
  const text = b.dataset.copy || cmdStore[+b.dataset.ci] || '';
  copyText(text, b);
});

/* ---------------- شروع ---------------- */
$('#repoLink').href = REPO_URL;
console.log('%c نت‌داکتر 🩺 ', 'background:#22d3ee;color:#081018;font-weight:bold;border-radius:4px', 'سیستم خبره عیب‌یابی اینترنت — آماده است!');
renderKB();
