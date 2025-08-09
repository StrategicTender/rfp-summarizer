// This file handles the logic for the RFP summarizer frontend.

const API_ENDPOINT = 'https://summarize-rfp-luyf37yvga-uc.a.run.app';

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('rfpFileInput');
    const summarizeButton = document.getElementById('summarizeButton');
    const summaryOutput = document.getElementById('summaryOutput');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Enable the button when a file is selected
    summarizeButton.disabled = true;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            summarizeButton.disabled = false;
        } else {
            summarizeButton.disabled = true;
        }
    });

    summarizeButton.addEventListener('click', async () => {
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select an RFP file to upload.');
            return;
        }

        loadingSpinner.style.display = 'block';
        summaryOutput.style.display = 'none';
        summarizeButton.disabled = true;

        try {
            const rfpContent = await readFileContent(file);
            const summary = await getSummaryFromBackend(rfpContent);
            displaySummary(summary);
        } catch (error) {
            console.error('Error:', error);
            summaryOutput.innerHTML = `<p style="color: red;">An error occurred while summarizing the RFP. Please try again.</p>`;
            summaryOutput.style.display = 'block';
        } finally {
            loadingSpinner.style.display = 'none';
            summarizeButton.disabled = false;
        }
    });

    async function readFileContent(file) {
        // Check the file type
        if (file.type === 'application/pdf') {
            // Handle PDF files
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const typedarray = new Uint8Array(e.target.result);
                    try {
                        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                        let text = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            text += content.items.map(item => item.str).join(' ');
                        }
                        resolve(text);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
            });
        } else {
            // Handle other text-based files (e.g., .txt)
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }
    }

    async function getSummaryFromBackend(rfpContent) {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rfp_content: rfpContent }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.text();
    }

    function displaySummary(summary) {
        summaryOutput.innerHTML = `<h3>Summary of the RFP</h3>${summary}`;
        summaryOutput.style.display = 'block';
    }
});