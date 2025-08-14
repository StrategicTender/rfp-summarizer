// netlify/functions/_auth.js
const { GoogleAuth } = require('google-auth-library');

async function getIdTokenHeader(audience) {
  const client_email = process.env.GCP_SA_CLIENT_EMAIL || '';
  let private_key = process.env.GCP_SA_PRIVATE_KEY || '';

  // If Netlify stored literal "\n", convert to real newlines.
  if (private_key.includes('\\n') && !private_key.includes('\n')) {
    private_key = private_key.replace(/\\n/g, '\n');
  }

  const auth = new GoogleAuth({ credentials: { client_email, private_key } });
  const idClient = await auth.getIdTokenClient(audience);
  const hdrs = await idClient.getRequestHeaders();
  return { Authorization: hdrs['Authorization'] || hdrs['authorization'] || '' };
}

module.exports = { getIdTokenHeader };
