// netlify/functions/ping.js
exports.handler = async () => {
  try {
    const url = process.env.GCP_FUNCTION_URL;
    if (!url) return { statusCode: 500, body: 'GCP_FUNCTION_URL not set' };
    const res = await fetch(url);
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
      body: text,
    };
  } catch (e) {
    return { statusCode: 500, body: `Proxy error: ${e.message}` };
  }
};
