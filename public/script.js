// public/script.js

// --- Config ---
// In production we call our Netlify function proxy, which forwards to Cloud Run.
const BACKEND = '/.netlify/functions/summarizer-proxy';

// --- State ---
let lastJson = null;

// --- DOM ---
const $ = (id) => document.getElementById(id);
const fileInput   = $('file');
const goBtn       = $('btn');
const outEl       = $('out');
const jsonEl      = $('json');
const tabSummary  = $('tabSummary');
const tabJson     = $('tabJson');
const panelSummary= $('panelSummary');
const panelJson   = $('panelJson');
const dlHtmlBtn   = $('dlHtmlBtn');
const dlJsonBtn   = $('dlJsonBtn');

// --- Helpers ---
function setBusy(busy) {
  goBtn.disabled = busy;
  fileInput.disabled = busy;
  goBtn.textContent = busy ? 'Working…' : 'Summarize RFP';
}

function showError(err) {
  const msg = (err && (err.message || err.toString())) || 'Unknown error';
  outEl.innerHTML = `<pre style="white-space:pre-wrap;color:#b91c1c;background:#fef2f2;border-radius:12px;padding:12px">
Error: ${msg}
</pre>`;
}

function showTab(which) {
  const summary = which === 'summary';
  tabSummary.classList.toggle('active', summary);
  tabJson.classList.toggle('active', !summary);
  panelSummary.classList.toggle('hidden', !summary);
  panelJson.classList.toggle('hidden', summary);
}

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2); }
  catch { return String(obj); }
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function enableDownloads() {
  const ok = !!lastJson;
  dlHtmlBtn.disabled = !ok;
  dlJsonBtn.disabled = !ok;
}

function renderSummary(data) {
  // Prefer server-produced HTML if available, else fallback to super-basic.
  const html = (data && data.summary_html)
    ? String(data.summary_html)
    : `<h2>Summary</h2><p>No formatted summary returned.</p>`;
  outEl.innerHTML = html;
}

function renderJson(data) {
  jsonEl.textContent = pretty(data || {});
}

async function run() {
  try {
    if (!fileInput.files || !fileInput.files[0]) {
      alert('Choose a PDF first.'); return;
    }
    setBusy(true);

    const fd = new FormData();
    fd.append('file', fileInput.files[0]);

    const res = await fetch(BACKEND, { method: 'POST', body: fd });
    const text = await res.text();

    let data;
    try { data = JSON.parse(text); }
    catch {
      // If backend ever returns HTML/plain on error
      throw new Error(res.ok ? 'Unexpected response' : `HTTP ${res.status}: ${text.slice(0,200)}`);
    }

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    lastJson = data;
    renderSummary(data);
    renderJson(data);
    enableDownloads();
    showTab('summary');  // default back to Summary after each run
  } catch (err) {
    showError(err);
  } finally {
    setBusy(false);
  }
}

// --- Wire up UI ---
document.addEventListener('DOMContentLoaded', () => {
  setBusy(false);
  enableDownloads();
  showTab('summary');

  goBtn.addEventListener('click', (e) => { e.preventDefault(); run(); });

  tabSummary.addEventListener('click', () => showTab('summary'));
  tabJson.addEventListener('click', () => showTab('json'));

  dlJsonBtn.addEventListener('click', () => {
    if (!lastJson) return;
    const name = (lastJson.rfp_no || 'rfp') + '.json';
    triggerDownload(new Blob([pretty(lastJson)], { type: 'application/json' }), name);
  });

  dlHtmlBtn.addEventListener('click', () => {
    if (!lastJson) return;
    const title = lastJson.rfp_no || 'RFP Summary';
    const htmlDoc = `<!doctype html><meta charset="utf-8">
<title>${title}</title>
<body>${lastJson.summary_html || '<h2>Summary</h2><p>No formatted summary returned.</p>'}</body>`;
    const name = (lastJson.rfp_no || 'rfp') + '-summary.html';
    triggerDownload(new Blob([htmlDoc], { type: 'text/html' }), name);
  });
});
