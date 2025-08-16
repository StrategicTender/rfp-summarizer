(() => {
  const $ = (id) => document.getElementById(id);

  // Elements (support both old & new IDs)
  const form = $('uploadForm') || null;
  const fileInput = $('rfpFile') || $('file');
  const btn = $('submitBtn') || $('go');
  const spinner = $('spinner') || $('loadingSpinner');
  let resultNode = $('resultOutput') || $('result') || $('out');

  // Backend endpoint (relative + meta override)
  const BACKEND_BASE = (window.BACKEND_URL || document.querySelector('meta[name="backend-url"]')?.content || '').replace(/\/+$/,'');
  const ENDPOINT = (BACKEND_BASE || '') + '/summarize_rfp';

  // UI helpers
  const statusLine = $('statusLine') || $('status') || (() => {
    const d = document.createElement('div'); d.id = 'statusLine';
    (resultNode?.parentNode || document.body).insertBefore(d, resultNode || null);
    return d;
  })();

  const setBusy = (b) => { try { spinner?.classList?.toggle('hidden', !b); } catch {} if (btn) btn.disabled = !!b; };
  const showStatus = (m) => { if (statusLine) statusLine.textContent = m; };
  const setResult = (html) => {
    if (!resultNode) return;
    if (resultNode.tagName === 'TEXTAREA') { resultNode.style.display=''; resultNode.value = html.replace(/<[^>]+>/g,''); }
    else { resultNode.innerHTML = html; }
  };

  // Enable button when a file is chosen
  const onFileChange = () => { if (btn) btn.disabled = !(fileInput && fileInput.files && fileInput.files[0]); };
  fileInput?.addEventListener('change', onFileChange);

  // Use multipart/form-data (best for large files). JSON/base64 fallback removed.
  async function runSummarize() {
    const file = fileInput?.files?.[0];
    if (!file) return;

    setBusy(true);
    showStatus(`Uploading ${file.name} (${Math.round(file.size/1024)} KB)...`);

    try {
      const fd = new FormData();
      fd.append('file', file, file.name);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(ENDPOINT || '/summarize_rfp', {
        method: 'POST',
        body: fd,              // IMPORTANT: do not set Content-Type manually
        signal: controller.signal
      }).catch((err) => { throw new Error(`Network error: ${err.message}`); });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend ${res.status}: ${text.slice(0,500)}`);
      }

      // Try JSON; if not JSON, show raw text
      const text = await res.text();
      let data, html;
      try { data = JSON.parse(text); } catch {}
      html = (data && (data.summary_html || data.html || data.summary)) || text || '<p>(No content returned)</p>';

      setResult(html);
      showStatus('Done.');
    } catch (err) {
      console.error(err);
      setResult(`<pre class="error">${escapeHtml(err?.message || 'Unknown error')}</pre>`);
      showStatus('Failed.');
    } finally {
      setBusy(false);
    }
  }

  // Wire up actions
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); runSummarize(); });
  if (btn)  btn.addEventListener('click',  (e) => { e.preventDefault?.(); runSummarize(); });

  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  onFileChange();
})();
