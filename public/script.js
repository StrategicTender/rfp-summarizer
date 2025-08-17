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

  
// ---- Download buttons (HTML & JSON)
function ensureDownloadButtons() {
  // try to attach near the top controls; fall back to <form> or <body>
  const host = document.querySelector('.controls') || document.querySelector('form') || document.body;
  if (!document.getElementById('dlHtmlBtn')) {
    const bar = document.createElement('div');
    bar.className = 'downloads';
    bar.style.marginTop = '8px';

    const htmlBtn = document.createElement('button');
    htmlBtn.id = 'dlHtmlBtn';
    htmlBtn.className = 'btn';
    htmlBtn.textContent = 'Download Summary (HTML)';
    htmlBtn.disabled = true;
    bar.appendChild(htmlBtn);

    const jsonBtn = document.createElement('button');
    jsonBtn.id = 'dlJsonBtn';
    jsonBtn.className = 'btn';
    jsonBtn.style.marginLeft = '8px';
    jsonBtn.textContent = 'Download Raw JSON';
    jsonBtn.disabled = true;
    bar.appendChild(jsonBtn);

    host.appendChild(bar);

    htmlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!lastJson) return;
      const title = `Summary: ${lastJson.rfp_no || 'RFP'}`;
      const html = '<!doctype html><meta charset="utf-8"><title>'+title+'</title><body>'+(lastJson.summary_html || '<p>(no HTML)</p>')+'</body>';
      triggerDownload(new Blob([html], { type: 'text/html' }), (lastJson.rfp_no || 'RFP') + '-summary.html');
    });

    jsonBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!lastJson) return;
      triggerDownload(new Blob([JSON.stringify(lastJson, null, 2)], { type: 'application/json' }), (lastJson.rfp_no || 'RFP') + '.json');
    });
  }
  // enable/disable state
  const hb = document.getElementById('dlHtmlBtn'), jb = document.getElementById('dlJsonBtn');
  const has = !!lastJson;
  if (jb) jb.disabled = !has;
  if (hb) hb.disabled = !has || !lastJson?.summary_html;
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


/* UTIL_EXPORTS */
(function(){
  function downloadText(filename, mime, text){
    try{
      const blob=new Blob([text],{type:mime});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob); a.download=filename;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},0);
    }catch(e){ alert('Download failed: '+e); }
  }
  async function copyText(text){
    try{ await navigator.clipboard.writeText(text); }
    catch(e){ alert('Copy failed: '+e); }
  }
  
// ---- Download buttons (HTML & JSON)
function ensureDownloadButtons() {
  // try to attach near the top controls; fall back to <form> or <body>
  const host = document.querySelector('.controls') || document.querySelector('form') || document.body;
  if (!document.getElementById('dlHtmlBtn')) {
    const bar = document.createElement('div');
    bar.className = 'downloads';
    bar.style.marginTop = '8px';

    const htmlBtn = document.createElement('button');
    htmlBtn.id = 'dlHtmlBtn';
    htmlBtn.className = 'btn';
    htmlBtn.textContent = 'Download Summary (HTML)';
    htmlBtn.disabled = true;
    bar.appendChild(htmlBtn);

    const jsonBtn = document.createElement('button');
    jsonBtn.id = 'dlJsonBtn';
    jsonBtn.className = 'btn';
    jsonBtn.style.marginLeft = '8px';
    jsonBtn.textContent = 'Download Raw JSON';
    jsonBtn.disabled = true;
    bar.appendChild(jsonBtn);

    host.appendChild(bar);

    htmlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!lastJson) return;
      const title = `Summary: ${lastJson.rfp_no || 'RFP'}`;
      const html = '<!doctype html><meta charset="utf-8"><title>'+title+'</title><body>'+(lastJson.summary_html || '<p>(no HTML)</p>')+'</body>';
      triggerDownload(new Blob([html], { type: 'text/html' }), (lastJson.rfp_no || 'RFP') + '-summary.html');
    });

    jsonBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!lastJson) return;
      triggerDownload(new Blob([JSON.stringify(lastJson, null, 2)], { type: 'application/json' }), (lastJson.rfp_no || 'RFP') + '.json');
    });
  }
  // enable/disable state
  const hb = document.getElementById('dlHtmlBtn'), jb = document.getElementById('dlJsonBtn');
  const has = !!lastJson;
  if (jb) jb.disabled = !has;
  if (hb) hb.disabled = !has || !lastJson?.summary_html;
}


document.addEventListener('DOMContentLoaded',()=>{
    const tabs=document.querySelector('.tabs'); if(!tabs) return;

    const makeBtn=(id,label,handler)=>{
      if(document.getElementById(id)) return;
      const b=document.createElement('button');
      b.id=id; b.type='button'; b.className='tab'; b.textContent=label;
      b.addEventListener('click',handler); tabs.appendChild(b);
    };

    makeBtn('btnCopyJson','Copy JSON',()=> {
      if(!window.lastJson) return alert('Run a summary first.');
      copyText(JSON.stringify(window.lastJson,null,2));
    });
    makeBtn('btnDownloadJson','Download JSON',()=> {
      if(!window.lastJson) return alert('Run a summary first.');
      downloadText('rfp-summary.json','application/json',
                   JSON.stringify(window.lastJson,null,2));
    });
    makeBtn('btnCopyHtml','Copy HTML',()=> {
      const html=(window.lastJson&& (lastJson.summary_html||lastJson.page_html))||'';
      if(!html) return alert('No HTML yet. Run a summary first.');
      copyText(html);
    });
    makeBtn('btnDownloadHtml','Download HTML',()=> {
      const html=(window.lastJson&& (lastJson.summary_html||lastJson.page_html))||'';
      if(!html) return alert('No HTML yet. Run a summary first.');
      const doc='<!doctype html><html><head><meta charset="utf-8"><title>RFP Summary</title></head><body>'+html+'</body></html>';
      downloadText('rfp-summary.html','text/html',doc);
    });
  });
})();

function triggerDownload(blob, filename){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}
function enableDownloads(){
  const has = typeof lastJson!=='undefined' && lastJson;
  const jb=document.getElementById('dlJsonBtn');
  const hb=document.getElementById('dlHtmlBtn');
  if(jb) jb.disabled=!has;
  if(hb) hb.disabled=!(has && lastJson.summary_html);
}
document.getElementById('dlJsonBtn')?.addEventListener('click', ()=>{
  if(!lastJson) return;
  const pretty=JSON.stringify(lastJson,null,2);
  triggerDownload(new Blob([pretty],{type:'application/json'}),(lastJson.rfp_no||'rfp')+'.json');
});
document.getElementById('dlHtmlBtn')?.addEventListener('click', ()=>{
  if(!lastJson || !lastJson.summary_html) return;
  const title='Summary: '+(lastJson.rfp_no||'RFP');
  const html='<!doctype html><html><meta charset="utf-8"><title>'+title+'</title><body>'+lastJson.summary_html+'</body></html>';
  triggerDownload(new Blob([html],{type:'text/html'}),(lastJson.rfp_no||'rfp')+'-summary.html');
});


// ===== Download buttons (HTML + JSON) – safe, idempotent =====
(() => {
  if (window.__dlPatched) return; window.__dlPatched = true;

  function fallbackDownload(blob, filename){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  const doDownload = (window.triggerDownload || fallbackDownload);

  function host(){
    return document.querySelector('.controls') || document.querySelector('form') || document.body;
  }

  function ensureButtons(){
    if (document.getElementById('dlHtmlBtn')) return;
    const h = host();
    const bar = document.createElement('div');
    bar.className = 'downloads';
    bar.style.marginTop = '8px';

    const htmlBtn = document.createElement('button');
    htmlBtn.id = 'dlHtmlBtn';
    htmlBtn.className = 'btn';
    htmlBtn.textContent = 'Download Summary (HTML)';
    htmlBtn.disabled = true;

    const jsonBtn = document.createElement('button');
    jsonBtn.id = 'dlJsonBtn';
    jsonBtn.className = 'btn';
    jsonBtn.style.marginLeft = '8px';
    jsonBtn.textContent = 'Download Raw JSON';
    jsonBtn.disabled = true;

    bar.appendChild(htmlBtn);
    bar.appendChild(jsonBtn);
    h.appendChild(bar);

    htmlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const j = window.lastJson || null;
      if (!j) return;
      const title = 'Summary: ' + (j.rfp_no || 'RFP');
      const html = '<!doctype html><meta charset="utf-8"><title>'+title+
        '</title><body>' + (j.summary_html || '<p>(no HTML)</p>') + '</body>';
      doDownload(new Blob([html], {type:'text/html'}), (j.rfp_no || 'RFP') + '-summary.html');
    });

    jsonBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const j = window.lastJson || null;
      if (!j) return;
      doDownload(new Blob([JSON.stringify(j, null, 2)], {type:'application/json'}),
                 (j.rfp_no || 'RFP') + '.json');
    });
  }

  function refresh(){
    ensureButtons();
    const j = window.lastJson || null;
    const hb = document.getElementById('dlHtmlBtn');
    const jb = document.getElementById('dlJsonBtn');
    const has = !!j;
    if (jb) jb.disabled = !has;
    if (hb) hb.disabled = !has || !j.summary_html;
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureButtons(); refresh();
    clearInterval(window.__dlTimer);
    window.__dlTimer = setInterval(refresh, 750); // polls for lastJson becoming available
  });
})();

