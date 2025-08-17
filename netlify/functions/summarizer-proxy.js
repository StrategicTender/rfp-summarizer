const ALLOWED = process.env.ALLOWED_ORIGIN || 'https://rfp-summarizer-final.netlify.app';
const BACKEND = process.env.BACKEND_URL;

const cors = (requestOrigin='') => ({
  // echo the caller for the browser, while we pin Cloud Run to ALLOWED
  'Access-Control-Allow-Origin': requestOrigin || ALLOWED,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
});

exports.handler = async (event) => {
  const requestOrigin = event.headers?.origin || '';
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(requestOrigin) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const res = await fetch(`${BACKEND}/summarize_rfp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // IMPORTANT: pin the Origin we present to Cloud Run to the allowed domain
        'Origin': ALLOWED,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return { statusCode: res.status, headers: cors(requestOrigin), body: text };
  } catch (err) {
    const body = JSON.stringify({ error: String(err && err.message || err || 'proxy error') });
    return { statusCode: 502, headers: cors(requestOrigin), body };
  }
};
