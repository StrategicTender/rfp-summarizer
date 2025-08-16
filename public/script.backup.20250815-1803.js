(() => {
  const $ = (id) => document.getElementById(id);

  // Elements (handle both old and new IDs)
  const form = $('uploadForm') || null;
  const fileInput = $('rfpFile') || $('file');
  const btn = $('submitBtn') || $('go');
  const spinner = $('spinner') || $('loadingSpinner');
  let resultNode = $('resultOutput') || $('result') || $('out');

  // Backend endpoint (relative so redirects work)
  const BACKEND_BASE =
    (window.BACKEND_URL || document.querySelector('meta[name="backend-url"]')?.content || '').replace(/\/+$/, '');
  const ENDPOINT = (BACKEND_BASE || '') + '/summarize_rfp';

  // Status line (reuse existing or create one)
  const statusLine =
    $('statusLine') ||
    $('status') ||
    (() => {
      const d = document.createElement('div');
      d.id = 'statusLine';
      (resultNode?.parentNode || document.body).insertBefore(d, resultNode || null);
      return d;
    })();

  const setBusy = (b) => { try { spinner?.classList?.toggle('hidden', !b); } catch {} if (btn) btn.disabled = !!b; };
  const showStatus = (m) => { if (statusLine) statusLine.textContent = m; };

  const setResult = (html) => {
    if (!resultNode) return;
    if (resultNode.tagName === 'TEXTAREA') {
      resultNode.style.display = '';
      resultNode.value = html.replace(/<[^>]+>/g, ''); // strip tags for textarea
    } else {
      resultNode.innerHTML = html;
    }
  };

  const onFileChange = () => { if (btn) btn.disabled = !(fileInput && fileInput.files && fileInput.files[0]); };
  fileInput?.addEventListener('change', onFileChange);

  async function runSummarize() {
    const file = fileInput?.files?.[0];
    if (!file) return;

    setBusy(true);
    showStatus(`Uploading ${file.name} (${Math.round(file.size / 1024)} KB)...`);

    try {
      const b64 = await fileToBase64(file);
      showStatus('Contacting backend...');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const res = await fetch(ENDPOINT || '/summarize_rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content: b64 }),
        signal: controller.signal
      }).catch((err) => { throw new Error(`Network error: ${err.message}`); });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend ${res.status}: ${text.slice(0, 500)}`);
      }

      const raw = await res.text();
      let data, html;
      try { data = JSON.parse(raw); } catch {}
      html = (data && (data.summary_html || data.html || data.summary)) || raw || '<p>(No content returned)</p>';

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

  // Wire up submission (form submit or button click)
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); runSummarize(); });
  if (btn)  btn.addEventListener('click', (e) => { e.preventDefault?.(); runSummarize(); });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Failed to read file'));
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.readAsDataURL(file);
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  onFileChange(); // set initial button state
})();
