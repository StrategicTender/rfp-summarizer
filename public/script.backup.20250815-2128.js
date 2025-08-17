(() => {
  const $ = (id) => document.getElementById(id);

  // Elements (support old & new IDs)
  const form = $('uploadForm') || null;
  const fileInput = $('rfpFile') || $('file');
  const btn = $('submitBtn') || $('go');
  const spinner = $('spinner') || $('loadingSpinner');

  // Result panes
  const htmlPane = $('nice') || $('resultOutput') || $('result') || null;
  const jsonPane = $('out') || null;

  // Tabs + French toggle
  const tabSummary = $('tab-summary');
  const tabRaw = $('tab-raw');
  const includeFr = $('includeFrench'); // checkbox we injected

  // Endpoint
  const BACKEND_BASE = (window.BACKEND_URL || document.querySelector('meta[name="backend-url"]')?.content || '').replace(/\/+$/,'');
  const ENDPOINT = (BACKEND_BASE || '') + '/summarize_rfp';

  // Status
  const statusLine = $('statusLine') || $('status') || (() => {
    const d = document.createElement('div'); d.id = 'statusLine';
    (htmlPane?.parentNode || jsonPane?.parentNode || document.body).insertBefore(d, (htmlPane || jsonPane) || null);
    return d;
  })();
  const setBusy = (b) => { try { spinner?.classList?.toggle('hidden', !b); } catch {} if (btn) btn.disabled = !!b; };
  const showStatus = (m) => { if (statusLine) statusLine.textContent = m; };

  // Language filter (simple, transparent heuristic)
  function isLikelyFrench(t) {
    const s = (' ' + (t || '') + ' ').toLowerCase();
    const diacritics = (s.match(/[éèêëàâîïôöùûçœ]/g) || []).length;
    const hits = [' le ', ' la ', ' les ', ' des ', ' du ', ' de ', ' et ', ' à ', " l'", " d'", ' une ', ' un ', ' pour ', ' sur ', ' avec ', ' soumission ', ' présentation ', ' courriel ']
      .reduce((n,w)=> n + (s.includes(w) ? 1 : 0), 0);
    return diacritics >= 2 || hits >= 2;
  }
  function maybeStripFrench(html) {
    // If user wants French, leave content intact
    if (includeFr?.checked) return html;
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    tmp.querySelectorAll('p, li').forEach(node => {
      const txt = node.textContent || '';
      if (isLikelyFrench(txt)) node.remove();
    });
    return tmp.innerHTML;
  }

  let lastHtml = ''; // remember raw html from backend
  const renderHtml = () => { if (htmlPane) htmlPane.innerHTML = maybeStripFrench(lastHtml); };
  const setRaw = (text) => { if (jsonPane) { jsonPane.style.display=''; jsonPane.readOnly = true; jsonPane.value = text; } };

  function showTab(which) {
    if (!htmlPane || !jsonPane) return;
    if (which === 'raw') {
      htmlPane.style.display = 'none'; jsonPane.style.display = 'block';
      tabRaw?.classList.add('active');  tabSummary?.classList.remove('active');
    } else {
      jsonPane.style.display = 'none'; htmlPane.style.display = 'block';
      tabSummary?.classList.add('active'); tabRaw?.classList.remove('active');
    }
  }

  const onFileChange = () => { if (btn) btn.disabled = !(fileInput && fileInput.files && fileInput.files[0]); };
  fileInput?.addEventListener('change', onFileChange);

  tabSummary?.addEventListener('click', () => showTab('summary'));
  tabRaw?.addEventListener('click', () => showTab('raw'));
  includeFr?.addEventListener('change', renderHtml); // re-render when toggled
  showTab('summary'); // default

  // Multipart upload
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
        body: fd,
        signal: controller.signal
      }).catch((err) => { throw new Error(`Network error: ${err.message}`); });
      clearTimeout(timeout);

      if (!res.ok) {
        const textErr = await res.text();
        setRaw(textErr);
        throw new Error(`Backend ${res.status}: ${textErr.slice(0,500)}`);
      }

      const text = await res.text();
      setRaw(text);

      let data;
      try { data = JSON.parse(text); } catch {}
      lastHtml = (data && (data.summary_html || data.html || data.summary)) || text || '<p>(No content returned)</p>';

      renderHtml();
      showTab('summary');
      showStatus('Done.');
    } catch (err) {
      console.error(err);
      lastHtml = `<pre class="error">${escapeHtml(err?.message || 'Unknown error')}</pre>`;
      renderHtml();
      showTab('summary');
      showStatus('Failed.');
    } finally {
      setBusy(false);
    }
  }

  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); runSummarize(); });
  if (btn)  btn.addEventListener('click',  (e) => { e.preventDefault?.(); runSummarize(); });

  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  onFileChange();
})();
