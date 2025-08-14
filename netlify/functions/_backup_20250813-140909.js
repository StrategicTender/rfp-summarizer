const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
  try {
    const backend = process.env.BACKEND_URL;
    const audience = process.env.BACKEND_AUDIENCE || backend;
    if (!backend) return json(500, { ok: false, error: 'BACKEND_URL not set' });

    // We expect JSON body like: { "file_content": "...", "filename": "..." }
    const body = event.body || '';
    const fwdHeaders = { 'content-type': 'application/json' };

    // Mint ID token with SA env vars (newline fix for PEM)
    const email = process.env.GCP_SA_CLIENT_EMAIL || '';
    const key = (process.env.GCP_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (email && key) {
      const jwt = new JWT({ email, key, additionalClaims: { target_audience: audience } });
      const idToken = await jwt.fetchIdToken(audience);
      fwdHeaders.authorization = `Bearer ${idToken}`;
    }

    // Forward to Cloud Run
    const resp = await fetch(backend, { method: 'POST', headers: fwdHeaders, body, redirect: 'manual' });
    const buf = Buffer.from(await resp.arrayBuffer());
    const outHeaders = {};
    for (const [k, v] of resp.headers) outHeaders[k.toLowerCase()] = v;

    const isBin = /(application\/pdf|application\/octet-stream|image|audio|video)/.test((outHeaders['content-type']||'').toLowerCase());
    return {
      statusCode: resp.status,
      headers: outHeaders,
      body: isBin ? buf.toString('base64') : buf.toString(),
      isBase64Encoded: isBin,
    };
  } catch (err) {
    return json(200, { ok: false, error: String(err && err.message || err) });
  }
};

function json(code, obj) {
  return { statusCode: code, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) };
}
