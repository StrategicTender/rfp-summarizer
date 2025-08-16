(() => {
  const $ = (id) => document.getElementById(id);

  // Elements (support both old & new IDs)
  const form = $('uploadForm') || null;
  const fileInput = $('rfpFile') || $('file');
  const btn = $('submitBtn') || $('go');
  const spinner = $('spinner') || $('loadingSpinner');

  // Two result panes: HTML (#nice) and Raw JSON (#out)
  const htmlPane = $('nice') || $('resultOutput') || $('result') || null;
  const jsonPane = $('out') || null;

  // Tabs
  const tabSummary = $('tab-summary');
  const tabRaw = $('tab-raw');

  // Backend endpoint (relative + meta override)
  const BACKEND_BASE = (window.BACKEND_URL || document.querySelector('meta[name="backend-url"]')?.content || '').replace(/\/+$/,'');
  const ENDPOINT = (BACKEND_BASE || '') + '/summarize_rfp';

  // UI helpers
  const statusLine = $('statusLine') || $('status') || (() => {
    const d = document.createElement('div'); d.id = 'statusLine';
    (htmlPane?.parentNode || jsonPane?.parentNode || document.body).insertBefore(d, (htmlPane || jsonPane) || null);
    return d;
  })();

  const setBusy = (b) => { try { spinner?.classList?.toggle('hidden', !b); } catch {} if (btn) btn.disabled = !!b; };
  const showStatus = (m) => { if (statusLine) statusLine.textContent = m; };

  const setResultHtml = (html) => {
    if (htmlPane) htmlPane.innerHTML = html;
  };
  const setRaw = (text) => {
    if (jsonPane) {
      jsonPane.style.display = '';
      jsonPane.readOnly = true;
      jsonPane.value = text;
    }
  };

  function showTab(which) {
    if (!htmlPane || !jsonPane) return;
    if (which === 'raw') {
      htmlPane.style.display = 'none';
      jsonPane.style.display = 'block';
      tabRaw?.classList.add('active');  tabSummary?.classList.remove('active');
    } else {
      jsonPane.style.display = 'none';
      htmlPane.style.display = 'block';
      tabSummary?.classList.add('active'); tabRaw?.classList.remove('active');
    }
  }

  // Enable button when a file is chosen
  const onFileChange = () => { if (btn) btn.disabled = !(fileInput && fileInput.files && fileInput.files[0]); };
  fileInput?.addEventListener('change', onFileChange);

  // Tab wiring
  tabSummary?.addEventListener('click', () => showTab('summary'));
  tabRaw?.addEventListener('click', () => showTab('raw'));
  showTab('summary'); // default

  // Use multipart/form-data (best for large files)
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
        const textErr = await res.text();
        setRaw(textErr);
        throw new Error(`Backend ${res.status}: ${textErr.slice(0,500)}`);
      }

      // Get both raw and parsed
      const text = await res.text();
      setRaw(text); // populate Raw JSON tab
      let data, html;
      try { data = JSON.parse(text); } catch {}
      html = (data && (data.summary_html || data.html || data.summary)) || text || '<p>(No content returned)</p>';

      setResultHtml(html);
      showTab('summary');
      showStatus('Done.');
    } catch (err) {
      console.error(err);
      setResultHtml(`<pre class="error">${escapeHtml(err?.message || 'Unknown error')}</pre>`);
      showTab('summary');
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
