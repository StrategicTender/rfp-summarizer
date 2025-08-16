const { GoogleAuth } = require("google-auth-library");

exports.handler = async (event) => {
  const origin = event.headers?.origin || "*";
  const baseHeaders = corsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: baseHeaders };
  }

  const {
    BACKEND_URL,
    BACKEND_AUDIENCE,
    PREVIEW_SECRET,
    GCP_SA_CLIENT_EMAIL,
    GCP_SA_PRIVATE_KEY,
    SA_EMAIL,
    SA_KEY,
  } = process.env;

  if (!BACKEND_URL) {
    return json(baseHeaders, 500, { error: "BACKEND_URL not set" });
  }

  try {
    // Prefer SA_* if present; otherwise fall back to GCP_SA_* (the ones we set).
    const email = SA_EMAIL || GCP_SA_CLIENT_EMAIL;
    let key = SA_KEY || GCP_SA_PRIVATE_KEY;
    if (key) key = key.replace(/\\n/g, "\n");

    // If we have explicit creds, use them; else let library try ADC.
    const auth =
      email && key
        ? new GoogleAuth({ credentials: { client_email: email, private_key: key } })
        : new GoogleAuth();

    const audience = BACKEND_AUDIENCE || BACKEND_URL;
    const client = await auth.getIdTokenClient(audience);
    const authHeaders = await client.getRequestHeaders(BACKEND_URL);

    const target = BACKEND_URL.replace(/\\/+$/, "") + "/v1/summarize";

    // Pass the body through as-is (frontend sends JSON already)
    const resp = await fetch(target, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        "X-Preview-Secret": PREVIEW_SECRET || "",
      },
      body: event.body || "{}",
    });

    const text = await resp.text();
    const outHeaders = { ...baseHeaders, "Content-Type": "application/json" };

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: outHeaders,
        body: JSON.stringify({ http_status: resp.status, error: text }),
      };
    }

    return { statusCode: 200, headers: outHeaders, body: text };
  } catch (err) {
    return json(baseHeaders, 502, {
      http_status: 502,
      error: String((err && err.stack) || err),
    });
  }
};

/* ---------- helpers ---------- */
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Preview-Secret",
  };
}

function json(headers, status, obj) {
  return {
    statusCode: status,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
