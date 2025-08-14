// netlify/functions/summarizer-proxy.js
const { getIdTokenHeader } = require('./_auth');

const ORIGIN = process.env.CORS_ORIGIN || '*';
const TARGET = process.env.BACKEND_URL;                     // Cloud Run URL (no trailing slash)
const AUD    = process.env.BACKEND_AUDIENCE || TARGET;      // audience for ID token

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...cors(), allow: 'POST' }, body: 'Use POST' };
  }

  if (!TARGET) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'BACKEND_URL not set' }) };
  }

  // Read/validate body
  const ctHeader = (event.headers['content-type'] || event.headers['Content-Type'] || 'application/json').toLowerCase();
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  if (ctHeader.includes('application/json')) {
    try { JSON.parse(raw || '{}'); }
    catch { return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'invalid JSON body' }) }; }
  }

  try {
    // Get Google-signed ID token for Cloud Run
    const authHdrs = await getIdTokenHeader(AUD);

    // Forward to backend
    const resp = await fetch(TARGET, {
      method: 'POST',
      headers: { ...authHdrs, 'content-type': ctHeader },
      body: raw,
    });

    const buf  = Buffer.from(await resp.arrayBuffer());
    const outCT = resp.headers.get('content-type') || 'application/octet-stream';
    const isBin = /(application\/pdf|application\/octet-stream|image|audio|video)/i.test(outCT);

    return {
      statusCode: resp.status,
      headers: { ...cors(), 'content-type': outCT },
      body: isBin ? buf.toString('base64') : buf.toString('utf8'),
      isBase64Encoded: isBin,
    };
  } catch (err) {
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'Proxy failed', detail: String(err?.message || err) }) };
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
