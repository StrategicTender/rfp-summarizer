const axios = require('axios');

exports.summarize_rfp = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method Not Allowed' });
    }

    try {
        const { rfpContent } = req.body;

        if (!rfpContent || typeof rfpContent !== 'string' || rfpContent.trim().length < 50) {
            return res.status(400).send({ error: 'Please provide a valid RFP with sufficient content (at least 50 characters)' });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error('API key not configured');
        }

        const prompt = `Summarize this RFP document, extracting:
        - Project Title
        - Issuing Organization
        - Submission Deadline
        - Budget Range
        - Key Requirements (bulleted)
        - Evaluation Criteria
        - Contact Information

        RFP Content:
        ${rfpContent.substring(0, 10000)}`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are an expert at summarizing Requests for Proposal (RFPs)"
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const summary = response.data.choices[0].message.content;
        res.status(200).send({ summary });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send({ error: 'An unexpected error occurred' });
    }
};
