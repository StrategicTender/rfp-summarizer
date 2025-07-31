document.addEventListener("DOMContentLoaded", () => {
    const rfpFileInput = document.getElementById("rfpFileInput");
    const summarizeButton = document.getElementById("summarizeButton");
    const loadingDiv = document.getElementById("loading");
    const errorDiv = document.getElementById("error");
    const summaryOutputDiv = document.getElementById("summaryOutput");
    const summaryTextP = document.getElementById("summaryText");

    let uploadedFile = null;

    rfpFileInput.addEventListener("change", (event) => {
        uploadedFile = event.target.files[0];
        if (uploadedFile) {
            summarizeButton.disabled = false;
            errorDiv.classList.add("hidden");
            summaryOutputDiv.classList.add("hidden");
        } else {
            summarizeButton.disabled = true;
        }
    });

    summarizeButton.addEventListener("click", async () => {
        if (!uploadedFile) {
            alert("Please select an RFP file first.");
            return;
        }

        loadingDiv.classList.remove("hidden");
        errorDiv.classList.add("hidden");
        summaryOutputDiv.classList.add("hidden");
        summaryTextP.textContent = "";

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Content = e.target.result.split(',')[1]; // Get only the base64 part
            const fileType = uploadedFile.type;
            const fileName = uploadedFile.name;

            try {
                const response = await fetch("/.netlify/functions/summarize-rfp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        fileContent: base64Content,
                        fileType: fileType,
                        fileName: fileName,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || errorData.error || "Something went wrong during summarization.");
                }

                const data = await response.json();
                summaryTextP.textContent = data.summary;
                summaryOutputDiv.classList.remove("hidden");

            } catch (error) {
                console.error("Error:", error);
                errorDiv.textContent = `Error: ${error.message}`;
                errorDiv.classList.remove("hidden");
            } finally {
                loadingDiv.classList.add("hidden");
            }
        };
        reader.readAsDataURL(uploadedFile); // Read file as Data URL (base64)
    });
});