const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const ticker = normalizeTicker(url.searchParams.get("ticker") || "");
    if (!ticker) return json({ error: "ticker_required" }, 400);

    if (!env.FMP_API_KEY) {
      return json({ error: "missing_fmp_api_key" }, 500);
    }

    const profile = await fetchFmpProfile(ticker, env.FMP_API_KEY);
    if (!profile) return json({ error: "not_found", ticker }, 404);

    return json(
      {
        symbol: ticker,
        name: profile.companyName || profile.symbol || ticker,
        sector: profile.sector || "",
        industry: profile.industry || "",
        exchange: profile.exchangeShortName || profile.exchange || "",
        assetType: profile.isEtf ? "ETF" : "Stock",
        beta: Number(profile.beta) || null,
        source: "fmp",
      },
      200,
      { "Cache-Control": "public, max-age=86400" }
    );
  },
};

async function fetchFmpProfile(ticker, apiKey) {
  const url = new URL("https://financialmodelingprep.com/stable/profile");
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data) || !data.length) return null;
  return data[0];
}

function normalizeTicker(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
