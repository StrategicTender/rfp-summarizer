// netlify/functions/summarizer-proxy.js
const { GoogleAuth } = require('google-auth-library');

const ORIGIN = process.env.CORS_ORIGIN || '*';
const TARGET = process.env.GCP_FUNCTION_URL || process.env.GCF_INVOKE_URL;

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ORIGIN,
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  if (!TARGET) return { statusCode: 500, body: JSON.stringify({ error: 'GCP_FUNCTION_URL not set' }) };
  if (!process.env.GCP_SA_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'GCP_SA_KEY not set' }) };

  // Parse JSON safely
  let payload = event.body;
  try {
    const ct = (event.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    payload = event.body || '';
  }

  try {
    const credentials = JSON.parse(process.env.GCP_SA_KEY);
    const auth = new GoogleAuth({ credentials });
    const client = await auth.getIdTokenClient(TARGET);

    const res = await client.request({
      url: TARGET,
      method: event.httpMethod || 'POST',
      headers: { 'Content-Type': event.headers['content-type'] || 'application/json' },
      data: payload,
      timeout: 300000,
    });

    return {
      statusCode: res.status || 200,
      headers: {
        'Access-Control-Allow-Origin': ORIGIN,
        'content-type': res.headers['content-type'] || 'text/plain',
      },
      body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': ORIGIN },
      body: JSON.stringify({ error: 'Proxy failed', detail: String(err?.message || err) }),
    };
  }
};
