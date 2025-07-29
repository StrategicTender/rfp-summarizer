document.addEventListener('DOMContentLoaded', () => {
    const rfpFileInput = document.getElementById('rfpFileInput');
    const summarizeButton = document.getElementById('summarizeButton');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const summaryOutputDiv = document.getElementById('summaryOutput');
    const summaryTextP = document.getElementById('summaryText');

    let uploadedFile = null;

    rfpFileInput.addEventListener('change', (event) => {
        uploadedFile = event.target.files[0];
        if (uploadedFile) {
            summarizeButton.disabled = false;
            errorDiv.classList.add('hidden');
            summaryOutputDiv.classList.add('hidden');
        } else {
            summarizeButton.disabled = true;
        }
    });

    summarizeButton.addEventListener('click', async () => {
        if (!uploadedFile) {
            alert('Please select an RFP file first.');
            return;
        }

        loadingDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        summaryOutputDiv.classList.add('hidden');
        summaryTextP.textContent = '';

        // Use FileReader to read the file as a Data URL (Base64 encoded)
        const reader = new FileReader();

        reader.onload = async (e) => {
            // e.target.result will be something like "data:application/pdf;base64,JVBER..."
            // We only need the base64 part after the comma.
            const base64Content = e.target.result.split(',')[1];
            const fileType = uploadedFile.type;
            const fileName = uploadedFile.name; // Keep filename for potential debugging/context

            try {
                const response = await fetch('/.netlify/functions/summarize-rfp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', // Send as JSON
                    },
                    body: JSON.stringify({ // Stringify the JSON payload
                        fileContent: base64Content,
                        fileType: fileType,
                        fileName: fileName,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Something went wrong during summarization.');
                }

                const data = await response.json();
                summaryTextP.textContent = data.summary;
                summaryOutputDiv.classList.remove('hidden');

            } catch (error) {
                console.error('Error:', error);
                errorDiv.textContent = `Error: ${error.message}`;
                errorDiv.classList.remove('hidden');
            } finally {
                loadingDiv.classList.add('hidden');
            }
        };

        reader.onerror = (e) => {
            console.error("FileReader error:", e);
            errorDiv.textContent = "Error reading file.";
            errorDiv.classList.remove('hidden');
            loadingDiv.classList.add('hidden');
        };

        reader.readAsDataURL(uploadedFile); // Read the file as a Data URL
    });
});