(() => {
  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('rfpFile');
  const btn = document.getElementById('submitBtn');
  const spinner = document.getElementById('spinner');
  const resultOutput = document.getElementById('resultOutput');
  const statusLine =
    document.getElementById('statusLine') ||
    (() => {
      const d = document.createElement('div');
      d.id = 'statusLine';
      d.className = 'status-line';
      (resultOutput?.parentNode || document.body).insertBefore(d, resultOutput || null);
      return d;
    })();

  // Prefer relative path so Netlify redirects can swap backends without changing code.
  const BACKEND_BASE =
    (window.BACKEND_URL ||
      document.querySelector('meta[name="backend-url"]')?.content ||
      ''
    ).replace(/\/+$/, '');
  const ENDPOINT = (BACKEND_BASE || '') + '/summarize_rfp';

  function setBusy(b) {
    try { spinner?.classList?.toggle('hidden', !b); } catch {}
    if (btn) btn.disabled = !!b;
  }
  function showStatus(msg) { statusLine.textContent = msg; }

  fileInput?.addEventListener('change', () => {
    if (btn) btn.disabled = !(fileInput.files && fileInput.files[0]);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
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
        signal: controller.signal,
      }).catch((err) => { throw new Error(`Network error: ${err.message}`); });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend ${res.status}: ${text.slice(0, 500)}`);
      }

      const raw = await res.text();
      let data, html;
      try { data = JSON.parse(raw); } catch {}
      html =
        (data && (data.summary_html || data.html || data.summary)) ||
        raw ||
        '<p>(No content returned)</p>';

      if (resultOutput) resultOutput.innerHTML = html;
      showStatus('Done.');
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Unknown error';
      if (resultOutput) resultOutput.innerHTML = `<pre class="error">${escapeHtml(msg)}</pre>`;
      showStatus('Failed.');
    } finally {
      setBusy(false);
    }
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();
