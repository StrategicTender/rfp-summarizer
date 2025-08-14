document.addEventListener('DOMContentLoaded', () => {
  const file = document.getElementById('file');
  const btn  = document.getElementById('go');
  const out  = document.getElementById('out');

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!file.files[0]) { out.textContent = 'Pick a file first.'; return; }
    btn.disabled = true; out.textContent = 'Uploading…';

    try {
      const fd = new FormData();
      fd.append('file', file.files[0], file.files[0].name);

      const res = await fetch('/.netlify/functions/summarizer-proxy', { method: 'POST', body: fd });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      out.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    } catch (err) {
      out.textContent = `Failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });
});
