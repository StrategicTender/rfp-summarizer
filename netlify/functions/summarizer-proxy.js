const ALLOWED = process.env.ALLOWED_ORIGIN || "";
const BACKEND  = process.env.BACKEND_URL;

function isAllowed(origin) {
  if (!origin) return false;
  try {
    // exact match on origin
    return origin === ALLOWED.replace(/\/$/, "");
  } catch { return false; }
}

function baseHeaders() {
  // Always include Vary: Origin so caches behave, but DO NOT include ACAO unless allowed
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/plain; charset=utf-8'
  };
}

function cors(allowed, requestOrigin) {
  const h = baseHeaders();
  if (allowed && requestOrigin) h['Access-Control-Allow-Origin'] = requestOrigin;
  return h;
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const requestOrigin = headers.origin || "";
  const allowed = isAllowed(requestOrigin);

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(allowed, requestOrigin) };
  }

  if (!allowed) {
    return {
      statusCode: 403,
      headers: cors(false, requestOrigin), // no ACAO when blocked
      body: JSON.stringify({ error: 'Forbidden: origin not allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    const res = await fetch(`${BACKEND}/summarize_rfp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': ALLOWED },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    return { statusCode: res.status, headers: cors(true, requestOrigin), body: text };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors(true, requestOrigin),
      body: JSON.stringify({ error: String(err?.message || err) })
    };
  }
};
