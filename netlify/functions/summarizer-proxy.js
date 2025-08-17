// Netlify Function: pass-through proxy to backend, with strict JSON response
const ALLOWED = "https://rfp-summarizer-final.netlify.app"; // your site
const BACKEND = process.env.BACKEND_URL;                    // already set

const cors = (ok, reqOrigin) => ({
  "access-control-allow-origin": ok ? (reqOrigin || ALLOWED) : "null",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "Content-Type, Origin",
  "vary": "Origin",
});

exports.handler = async (event) => {
  const reqOrigin = (event.headers?.origin || "").toLowerCase();

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(true, reqOrigin) };
  }

  // Origin check (pin to final site)
  if (reqOrigin !== ALLOWED) {
    return {
      statusCode: 403,
      headers: cors(false, reqOrigin),
      body: JSON.stringify({ error: "Forbidden: origin not allowed" }),
    };
  }

  // Require POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: cors(true, reqOrigin),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Netlify encodes multipart bodies; decode if needed
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "", "utf8");

    const contentType = event.headers["content-type"] || "application/octet-stream";

    // Forward as-is to backend /summarize_rfp
    const r = await fetch(`${BACKEND}/summarize_rfp`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Origin": ALLOWED,
      },
      body: rawBody,
    });

    const txt = await r.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch (_) {
      // Backend didn't return JSON; surface a helpful error
      return {
        statusCode: 502,
        headers: { ...cors(true, reqOrigin), "content-type": "application/json" },
        body: JSON.stringify({
          error: "Backend returned non-JSON",
          snippet: txt.slice(0, 200),
        }),
      };
    }

    return {
      statusCode: r.status,
      headers: { ...cors(true, reqOrigin), "content-type": "application/json" },
      body: JSON.stringify(json),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(true, reqOrigin),
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  }
};
