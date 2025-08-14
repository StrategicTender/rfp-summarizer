/**
 * Strategic Tender — RFP Summarizer UI script
 * - Sends JSON { file_content, filename } to the Netlify proxy
 * - Renders a clean, readable summary (basic markdown → HTML)
 */

(() => {
  const $ = (id) => document.getElementById(id);

  const fileInput = $('file');
  const goBtn = $('go');
  const statusEl = $('status');
  const outEl = $('out');
  const niceEl = $('nice');

  const setStatus = (msg) => { statusEl.textContent = msg; };

  // Only toggle the GO button. Never disable the file input.
  const setBusy = (busy) => {
    const hasFile = !!(fileInput.files && fileInput.files.length);
    goBtn.disabled = busy || !hasFile;
  };

  // Enable button when a file is chosen
  fileInput.addEventListener('change', () => {
    setStatus(fileInput.files?.length ? 'Ready to upload.' : 'Choose a PDF to begin.');
    setBusy(false);
  });

  // Read a File as base64 (no prefix)
  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Failed to read file.'));
      fr.onload = () => {
        try {
          const s = String(fr.result || '');
          const comma = s.indexOf(',');
          if (comma === -1) return reject(new Error('Unexpected data URL format.'));
          resolve(s.slice(comma + 1)); // strip "data:...;base64,"
        } catch (e) { reject(e); }
      };
      fr.readAsDataURL(file);
    });
  }

  // Escape HTML
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  // Very small markdown-ish renderer for **bold**, headings, bullets, newlines
  function mdish(s) {
    let t = String(s);

    // Convert Windows newlines
    t = t.replace(/\r\n/g, '\n');

    // Split into paragraphs by blank line
    const blocks = t.split(/\n{2,}/);

    const html = blocks.map(block => {
      // Bulleted list (lines starting with - or •)
      if (/^(\s*[-•]\s+)/m.test(block)) {
        const items = block.split('\n').filter(Boolean).map(line =>
          line.replace(/^\s*[-•]\s*/, '').trim()
        ).map(li => `<li>${inline(li)}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      // Heading patterns like "**Title:**", or leading **
      if (/^\*\*.+\*\*/.test(block) && !block.includes(':')) {
        return `<h2>${inline(block.replace(/^\*\*|\*\*$/g, ''))}</h2>`;
      }
      // Paragraph
      const lines = block.split('\n').map(inline);
      return `<p>${lines.join('<br>')}</p>`;
    }).join('\n');

    return html;
  }

  // Inline formatting: **bold**
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // Render server response into the pretty panel + raw textarea
  function present(body) {
    try {
      outEl.value = JSON.stringify(body, null, 2);
    } catch {
      outEl.value = String(body);
    }

    // Prefer a 'summary' field when present
    if (body && typeof body === 'object' && typeof body.summary === 'string') {
      niceEl.innerHTML = mdish(body.summary);
      return;
    }
    // If it's a string, render it
    if (typeof body === 'string') {
      niceEl.innerHTML = mdish(body);
      return;
    }
    // Otherwise show the object keys in a simple list
    try {
      const keys = Object.keys(body || {});
      niceEl.innerHTML = `<p><strong>Response Keys:</strong> ${keys.map(esc).join(', ') || '—'}</p>`;
    } catch {
      niceEl.innerHTML = `<p>${esc(String(body))}</p>`;
    }
  }

  async function summarize() {
    const f = fileInput.files?.[0];
    if (!f) { setStatus('No file selected.'); return; }
    if (!/\.pdf$/i.test(f.name)) {
      setStatus('Please select a PDF file.'); return;
    }

    setBusy(true);
    outEl.value = '';
    niceEl.innerHTML = '';
    setStatus('Reading file…');

    try {
      const b64 = await readAsBase64(f);
      setStatus('Uploading to backend…');

      const res = await fetch('/.netlify/functions/summarizer-proxy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file_content: b64, filename: f.name }),
      });

      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();

      if (!res.ok) {
        present({ http_status: res.status, error: body });
        setStatus(`Error ${res.status}. See details below.`);
        return;
      }

      present(body);
      setStatus('Done.');
    } catch (err) {
      present({ error: String((err && err.message) || err) });
      setStatus('Failed. See details below.');
    } finally {
      setBusy(false);
    }
  }

  goBtn.addEventListener('click', (e) => {
    e.preventDefault();
    summarize();
  });

  // Initial state
  setBusy(false);
  setStatus('Choose a PDF to begin.');
})();
