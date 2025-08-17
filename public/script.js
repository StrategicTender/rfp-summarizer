/* Strategic Tender — RFP Summarizer UI glue (form-safe)
   Prevents default form submit so the chosen file stays selected. */

(() => {
  const API_BASE = 'https://summarize-rfp-v2-293196834043.us-central1.run.app';
  const API_URL  = API_BASE + '/summarize_rfp';

  const $ = (id) => document.getElementById(id);
  const out = $('resultOutput') || $('out');
  const btn = $('summarizeBtn') || $('btn');
  const fileInput = $('pdfInput') || $('file');
  const spinner = $('spinner') || $('loading');
  const form = $('summarizeForm') || document.querySelector('form');

  if (form) form.addEventListener('submit', (e) => e.preventDefault());
  if (btn && btn.getAttribute('type') !== 'button') btn.setAttribute('type', 'button');

  function setBusy(b) {
    if (spinner) spinner.style.display = b ? 'inline-block' : 'none';
    if (btn) { btn.disabled = b; btn.ariaBusy = String(b); }
  }

  function b64FromArrayBuffer(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function run() {
    try {
      const f = fileInput?.files?.[0];
      if (!f) { alert('Choose a PDF first.'); return; }
      setBusy(true);
      out && (out.innerHTML = '<p>Uploading & summarizing…</p>');

      const buf = await f.arrayBuffer();
      const b64 = b64FromArrayBuffer(buf);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: f.name,
          content: b64,
          options: { language: 'en' }
        }),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch { throw new Error(`Non-JSON response (${res.status}). Body: ${text.slice(0,300)}…`); }
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const missing = Array.isArray(json?.missing) ? json.missing : [];
      const html = json?.summary_html || json?.page_html || '';
      const notice = missing.length ? `<h2>Missing</h2><p>${missing.join(', ') || 'none'}</p>` : '';

      if (out) out.innerHTML = (notice ? notice : '') + `<h2>Summary</h2>` + (html || '<p>(no html)</p>');
    } catch (err) {
      console.error(err);
      out && (out.innerHTML = `<pre style="white-space:pre-wrap">Error: ${String(err.message || err)}</pre>`);
      alert(`Error: ${String(err.message || err)}`);
    } finally { setBusy(false); }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setBusy(false);
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); run(); });
    if (fileInput && btn) btn.addEventListener('change', () => {
      btn.disabled = !(fileInput.files && fileInput.files.length > 0);
    });
  });
})();


// ---- export helpers (appended) ----
(function(){
  function downloadText(filename, mime, text) {
    try {
      const blob = new Blob([text], {type: mime});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
    } catch(e){ alert('Download failed: ' + e); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelector('.tabs');
    if(!tabs) return;

    if(!document.getElementById('btnDownloadJson')){
      const btnJson = document.createElement('button');
      btnJson.id = 'btnDownloadJson';
      btnJson.type = 'button';
      btnJson.className = 'tab';
      btnJson.textContent = 'Download JSON';
      btnJson.addEventListener('click', () => {
        if (!window.lastJson) { alert('Run a summary first.'); return; }
        const pretty = JSON.stringify(window.lastJson, null, 2);
        downloadText('rfp-summary.json', 'application/json', pretty);
      });
      tabs.appendChild(btnJson);
    }

    if(!document.getElementById('btnDownloadHtml')){
      const btnHtml = document.createElement('button');
      btnHtml.id = 'btnDownloadHtml';
      btnHtml.type = 'button';
      btnHtml.className = 'tab';
      btnHtml.textContent = 'Download HTML';
      btnHtml.addEventListener('click', () => {
        if (!window.lastJson || !(window.lastJson.summary_html || window.lastJson.page_html)) {
          alert('No HTML available yet. Run a summary first.'); return;
        }
        const body = (window.lastJson.summary_html || window.lastJson.page_html || '');
        const doc = `<!doctype html><html><head><meta charset="utf-8"><title>RFP Summary</title></head><body>${body}</body></html>`;
        downloadText('rfp-summary.html', 'text/html', doc);
      });
      tabs.appendChild(btnHtml);
    }
  });
})();
