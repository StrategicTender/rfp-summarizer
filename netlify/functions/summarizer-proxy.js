const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { rfpContent } = JSON.parse(event.body);

    if (!rfpContent || typeof rfpContent !== 'string' || rfpContent.trim().length < 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Please provide a valid RFP with sufficient content (at least 50 
characters)' })
      };
    }

    const encodedKey = `YOUR_BASE64_KEY_STRING_HERE`;
    const credentials = JSON.parse(Buffer.from(encodedKey, 'base64').toString('ascii'));

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const audience = 'https://us-central1-strategic-tender-rfp.cloudfunctions.net/summarize_rfp';
    const idToken = await client.idToken.fetchIdToken(audience);

    const response = await axios.post(audience, { rfpContent }, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const summary = response.data.choices[0].message.content;
    return {
      statusCode: 200,
      body: JSON.stringify({ summary })
    };
  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An unexpected error occurred' })
    };
  }
};
