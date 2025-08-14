cat > script.js <<'EOF'
(() => {
  const fileInput   = document.getElementById("rfpFile");
  const btn         = document.getElementById("summarizeBtn");
  const statusEl    = document.getElementById("status");
  const resultEl    = document.getElementById("result");
  const BACKEND_URL = (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) || "";
  const setStatus = (msg) => { statusEl.textContent = msg || ""; };
  const setResult = (msg) => { resultEl.textContent = msg || ""; };
  const enableIfValid = () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) { btn.disabled = true; return; }
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    btn.disabled = !isPdf;
    setStatus(isPdf ? `Ready: ${f.name}` : "Please choose a PDF file.");
  };
  fileInput.addEventListener("change", enableIfValid);
  btn.addEventListener("click", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    setResult("");
    setStatus("Uploading and summarizing…");
    if (!BACKEND_URL) {
      setStatus("Backend URL is not configured.");
      setResult("Set window.APP_CONFIG.BACKEND_URL in index.html.");
      return;
    }
    try {
      const form = new FormData();
      form.append("file", f, f.name);
      const resp = await fetch(BACKEND_URL, { method: "POST", body: form });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status} – ${resp.statusText}${errText ? `\n${errText}` : ""}`);
      }
      const contentType = resp.headers.get("content-type") || "";
      let textOut = "";
      if (contentType.includes("application/json")) {
        const json = await resp.json();
        textOut = json.summary || JSON.stringify(json, null, 2);
      } else {
        textOut = await resp.text();
      }
      setStatus("Done.");
      setResult(textOut || "(No content returned)");
    } catch (err) {
      setStatus("Failed.");
      setResult(String(err && err.message ? err.message : err));
      console.error(err);
    }
  });
  enableIfValid();
})();
EOF
