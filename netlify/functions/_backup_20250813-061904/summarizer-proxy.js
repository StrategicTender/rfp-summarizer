// netlify/functions/summarizer-proxy.js
/**
 * Proxies uploads to your Cloud Run service.
 * - Mints a Google ID token with your service account (env)
 * - Forwards method/headers/body
 * - Returns Cloud Run response (JSON or binary)
 *
 * ENV needed:
 *   GCP_FUNCTION_URL      -> exact Cloud Run URL (no trailing slash)
 *   GCP_SA_CLIENT_EMAIL   -> service account email
 *   GCP_SA_PRIVATE_KEY    -> private key (with \n escapes)
 */

const { GoogleAuth } = require("google-auth-library");

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
        body: "",
      };
    }

    const RUN_URL = process.env.GCP_FUNCTION_URL;
    const SA_EMAIL = process.env.GCP_SA_CLIENT_EMAIL;
    const SA_KEY = (process.env.GCP_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!RUN_URL || !SA_EMAIL || !SA_KEY) {
      return {
        statusCode: 500,
        headers: { "content-type": "text/plain", "Access-Control-Allow-Origin": "*" },
        body: "Missing credentials: set GCP_FUNCTION_URL, GCP_SA_CLIENT_EMAIL, GCP_SA_PRIVATE_KEY.",
      };
    }

    // Mint an ID token for Cloud Run (audience = RUN_URL)
    const auth = new GoogleAuth({ credentials: { client_email: SA_EMAIL, private_key: SA_KEY } });
    const idToken = await auth.fetchIdToken(RUN_URL);

    // Forward headers (preserve content-type)
    const fwdHeaders = new Headers();
    const ct = event.headers?.["content-type"] || event.headers?.["Content-Type"];
    if (ct) fwdHeaders.set("content-type", ct);
    fwdHeaders.set("authorization", `Bearer ${idToken}`);

    // Body (handles base64 for file uploads)
    const method = event.httpMethod || "GET";
    let body;
    if (!["GET", "HEAD"].includes(method)) {
      body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body || undefined;
    }

    const res = await fetch(RUN_URL, { method, headers: fwdHeaders, body });
    const resCT = res.headers.get("content-type") || "text/plain";
    const isBin = /(application\/octet-stream|pdf|zip|image\/|audio\/|video\/)/i.test(resCT);

    if (isBin) {
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        statusCode: res.status,
        headers: { "Access-Control-Allow-Origin": "*", "content-type": resCT },
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    }

    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { "Access-Control-Allow-Origin": "*", "content-type": resCT },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err?.message || err), stack: err?.stack }),
    };
  }
};
