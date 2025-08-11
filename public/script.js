(() => {
  const fileInput = document.getElementById("rfpFile");
  const btn = document.getElementById("summarizeBtn");
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");
  const setStatus = (m)=> statusEl.textContent = m || "";
  const setResult = (m)=> resultEl.textContent = m || "";

  const enableIfValid = () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) { btn.disabled = true; return; }
    const isPdf = f.type === "application/pdf" || /\.pdf$/
