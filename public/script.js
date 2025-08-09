const fileInput = document.getElementById('fileInput');
const summarizeBtn = document.getElementById('summarizeBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultOutput = document.getElementById('result');

// Enable the button when a file is selected
fileInput.addEventListener('change', () => {
  summarizeBtn.disabled = !fileInput.files.length;
});

summarizeBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (!file) return;

  loadingSpinner.style.display = 'block';
  resultOutput.textContent = '';

  const reader = new FileReader();

  reader.onload = async function () {
    const arrayBuffer = reader.result;
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64
    const base64String = btoa(String.fromCharCode(...uint8Array));

    try {
      const response = await fetch('https://summarize-rfp-v2-293196834043.us-central1.run.app/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content: base64String,
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      resultOutput.textContent = data.summary || 'No summary received.';
    } catch (err) {
      console.error(err);
      resultOutput.textContent = '❌ Error: Failed to load summary.';
    } finally {
      loadingSpinner.style.display = 'none';
    }
  };

  reader.onerror = function () {
    loadingSpinner.style.display = 'none';
    resultOutput.textContent = '❌ Error reading file.';
  };

  reader.readAsArrayBuffer(file); // ✅ Works with all file types + Safari
});
