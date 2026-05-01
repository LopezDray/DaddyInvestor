const $ = (id) => document.getElementById(id);

const FINNHUB_API_KEY = "d7mvaa9r01qngrvpii50d7mvaa9r01qngrvpii5g";
const FAST_MODE = true;
const CHART_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const DATA_CACHE_VERSION = "close-canonical-v2";
const DISPLAY_SMOOTH_DAYS = 1;

const state = {
  candles: [],
  analysis: null,
  symbol: "AAPL",
  displaySymbol: "AAPL",
  instrument: null,
  provider: "Stooq free daily data",
  quote: null,
  finnhubKey: "",
  requestId: 0,
};

const SYMBOL_ALIASES = {
  XAUUSD: { dataSymbol: "XAUUSD=X", dataSymbols: ["XAUUSD=X"], fallbackDataSymbols: ["GC=F"], finnhub: { endpoint: "forex/candle", symbol: "OANDA:XAU_USD", label: "Finnhub forex XAU/USD" }, displaySymbol: "XAUUSD", label: "ทองโลก USD", prefix: "$", suffix: "", yahooOnly: true },
  "XAUUSD=X": { dataSymbol: "XAUUSD=X", dataSymbols: ["XAUUSD=X"], fallbackDataSymbols: ["GC=F"], finnhub: { endpoint: "forex/candle", symbol: "OANDA:XAU_USD", label: "Finnhub forex XAU/USD" }, displaySymbol: "XAUUSD", label: "ทองโลก USD", prefix: "$", suffix: "", yahooOnly: true },
  GOLD: { dataSymbol: "XAUUSD=X", dataSymbols: ["XAUUSD=X"], fallbackDataSymbols: ["GC=F"], finnhub: { endpoint: "forex/candle", symbol: "OANDA:XAU_USD", label: "Finnhub forex XAU/USD" }, displaySymbol: "XAUUSD", label: "ทองโลก USD", prefix: "$", suffix: "", yahooOnly: true },
  BTC: { dataSymbol: "BTC-USD", displaySymbol: "BTC", label: "Bitcoin USD", prefix: "$", suffix: "", yahooOnly: true },
  BTCUSD: { dataSymbol: "BTC-USD", displaySymbol: "BTC", label: "Bitcoin USD", prefix: "$", suffix: "", yahooOnly: true },
  "BTC-USD": { dataSymbol: "BTC-USD", displaySymbol: "BTC", label: "Bitcoin USD", prefix: "$", suffix: "", yahooOnly: true },
  ETH: { dataSymbol: "ETH-USD", displaySymbol: "ETH", label: "Ethereum USD", prefix: "$", suffix: "", yahooOnly: true },
  ETHUSD: { dataSymbol: "ETH-USD", displaySymbol: "ETH", label: "Ethereum USD", prefix: "$", suffix: "", yahooOnly: true },
  "ETH-USD": { dataSymbol: "ETH-USD", displaySymbol: "ETH", label: "Ethereum USD", prefix: "$", suffix: "", yahooOnly: true },
  SET: { dataSymbol: "^SET.BK", dataSymbols: ["^SET.BK", "SET.BK"], displaySymbol: "SET", label: "ดัชนี SET ไทย", prefix: "", suffix: " จุด", yahooOnly: true },
  SETINDEX: { dataSymbol: "^SET.BK", dataSymbols: ["^SET.BK", "SET.BK"], displaySymbol: "SET", label: "ดัชนี SET ไทย", prefix: "", suffix: " จุด", yahooOnly: true },
  "SET.BK": { dataSymbol: "^SET.BK", dataSymbols: ["^SET.BK", "SET.BK"], displaySymbol: "SET", label: "ดัชนี SET ไทย", prefix: "", suffix: " จุด", yahooOnly: true },
  "^SET.BK": { dataSymbol: "^SET.BK", dataSymbols: ["^SET.BK", "SET.BK"], displaySymbol: "SET", label: "ดัชนี SET ไทย", prefix: "", suffix: " จุด", yahooOnly: true },
};

function instrumentDefaults(symbol) {
  return {
    dataSymbol: symbol,
    dataSymbols: [symbol],
    displaySymbol: symbol,
    label: "สินทรัพย์จดทะเบียนสหรัฐ",
    prefix: "$",
    suffix: "",
    yahooOnly: false,
  };
}

function resolveInstrument(raw) {
  const clean = normalizeSymbol(raw) || "AAPL";
  const compact = clean.replace(/[./]/g, "");
  const alias = SYMBOL_ALIASES[clean] || SYMBOL_ALIASES[compact];
  const instrument = alias ? { ...alias } : instrumentDefaults(clean);
  if (!instrument.dataSymbols) instrument.dataSymbols = [instrument.dataSymbol];
  if (!instrument.fallbackDataSymbols) instrument.fallbackDataSymbols = [];
  return instrument;
}

function money(value, symbol = state.symbol) {
  if (!Number.isFinite(value)) return "-";
  const instrument = symbol === state.symbol ? state.instrument : SYMBOL_ALIASES[symbol];
  const prefix = instrument?.prefix ?? "$";
  const suffix = instrument?.suffix ?? "";
  const decimals = value >= 100 ? 2 : 3;
  return `${prefix}${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

function pct(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatMarketDate(dateText) {
  if (!dateText) return "-";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeSymbol(raw) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
}

function getFinnhubKey() {
  return FINNHUB_API_KEY;
}

function toStooqSymbol(symbol) {
  if (SYMBOL_ALIASES[symbol]?.yahooOnly) return null;
  if (symbol.includes(".")) return symbol.toLowerCase();
  return `${symbol}.us`.toLowerCase();
}

function cacheKey(symbol) {
  return `daddyInvestorCandles:${DATA_CACHE_VERSION}:${symbol}`;
}

function getCachedCandles(symbol) {
  const stores = [sessionStorage, localStorage];
  try {
    for (const store of stores) {
      const current = readCachedCandles(store.getItem(cacheKey(symbol)));
      if (current) return current;
    }

    const suffix = `:${symbol}`;
    const candidates = [];
    for (const store of stores) {
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (key?.startsWith("daddyInvestorCandles:") && key.endsWith(suffix)) {
          const cached = JSON.parse(store.getItem(key) || "null");
          if (cached?.savedAt && Array.isArray(cached.candles)) candidates.push(cached);
        }
      }
    }

    candidates.sort((a, b) => b.savedAt - a.savedAt);
    for (const cached of candidates) {
      const candles = readCachedCandles(JSON.stringify(cached));
      if (candles) return candles;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function readCachedCandles(raw) {
  const cached = JSON.parse(raw || "null");
  if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS || !Array.isArray(cached.candles)) return null;
  if (cached.candles.length < 180) return null;
  return cached.candles;
}

function setCachedCandles(symbol, candles) {
  try {
    const payload = JSON.stringify({ savedAt: Date.now(), candles });
    sessionStorage.setItem(cacheKey(symbol), payload);
    localStorage.setItem(cacheKey(symbol), payload);
  } catch (error) {
    // Ignore cache quota limits.
  }
}

async function fetchStooq(symbol, stooqSymbolOverride = null) {
  const stooqSymbol = stooqSymbolOverride || toStooqSymbol(symbol);
  if (!stooqSymbol) throw new Error("Stooq ไม่มีชุดข้อมูลสำหรับสินทรัพย์นี้");
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
  const csv = await fetchText(url);
  const candles = parseStooqCsv(csv);
  if (candles.length < 180) throw new Error("ข้อมูลย้อนหลังไม่พอสำหรับคำนวณระยะยาว");
  state.provider = "Stooq daily chart";
  return candles;
}

async function fetchYahoo(symbol) {
  try {
    return await Promise.any([
      fetchYahooRange(symbol, "query1.finance.yahoo.com", "5y"),
      fetchYahooRange(symbol, "query2.finance.yahoo.com", "5y"),
    ]);
  } catch (fiveYearError) {
    try {
      return await Promise.any([
        fetchYahooRange(symbol, "query1.finance.yahoo.com", "2y"),
        fetchYahooRange(symbol, "query2.finance.yahoo.com", "2y"),
      ]);
    } catch (twoYearError) {
      return Promise.any([
        fetchYahooRange(symbol, "query1.finance.yahoo.com", "1y"),
        fetchYahooRange(symbol, "query2.finance.yahoo.com", "1y"),
      ]);
    }
  }
}

async function fetchYahooRange(symbol, base, range) {
  const url = `https://${base}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=history&includeAdjustedClose=true`;
  const payload = await fetchJson(url, `Yahoo chart ${range}`);
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp;
  if (!result || !quote || !Array.isArray(timestamps)) throw new Error("รูปแบบข้อมูล Yahoo Finance ไม่ถูกต้อง");

  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const gmtoffset = result.meta?.gmtoffset || 0;
  const candles = timestamps
    .map((timestamp, index) => {
      const date = new Date((timestamp + gmtoffset) * 1000).toISOString().slice(0, 10);
      const close = Number(adjusted[index] ?? quote.close?.[index]);
      return {
        date,
        open: Number(quote.open?.[index]),
        high: Number(quote.high?.[index]),
        low: Number(quote.low?.[index]),
        close,
        volume: Number(quote.volume?.[index]),
      };
    })
    .filter((candle) => candle.date && Number.isFinite(candle.close) && candle.close > 0)
    .filter((candle) => isCompletedMarketDate(candle.date));

  if (candles.length < 180) throw new Error(`ข้อมูล Yahoo Finance ${range} ย้อนหลังไม่พอ`);
  state.provider = `Yahoo chart ${range}`;
  return candles;
}

async function fetchYahooPeriod(symbol) {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 60 * 60 * 24 * 370;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${oneYearAgo}&period2=${now}&interval=1d&events=history&includeAdjustedClose=true`;
  const payload = await fetchJson(url, "Yahoo chart period");
  const result = payload?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp;
  if (!result || !quote || !Array.isArray(timestamps)) throw new Error("รูปแบบข้อมูล Yahoo period ไม่ถูกต้อง");

  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const gmtoffset = result.meta?.gmtoffset || 0;
  const candles = timestamps
    .map((timestamp, index) => {
      const date = new Date((timestamp + gmtoffset) * 1000).toISOString().slice(0, 10);
      const close = Number(adjusted[index] ?? quote.close?.[index]);
      return {
        date,
        open: Number(quote.open?.[index]),
        high: Number(quote.high?.[index]),
        low: Number(quote.low?.[index]),
        close,
        volume: Number(quote.volume?.[index]),
      };
    })
    .filter((candle) => candle.date && Number.isFinite(candle.close) && candle.close > 0)
    .filter((candle) => isCompletedMarketDate(candle.date));

  if (candles.length < 180) throw new Error("ข้อมูล Yahoo period ย้อนหลังไม่พอ");
  state.provider = "Yahoo chart period";
  return candles;
}

async function fetchFinnhubCandles(symbol) {
  const token = state.finnhubKey;
  if (!token) throw new Error("ยังไม่มี Finnhub API key");

  const to = Math.floor(Date.now() / 1000);
  const yearSeconds = 60 * 60 * 24 * 365;
  const windows = [5, 3, 1];
  let lastError = null;

  for (const years of windows) {
    try {
      const from = to - yearSeconds * years;
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(token)}`;
      const payload = await fetchJson(url, "Finnhub daily candles");
      if (payload?.s !== "ok" || !Array.isArray(payload.t)) throw new Error(`Finnhub ไม่มีข้อมูลกราฟ ${years} ปี`);

      const candles = payload.t
        .map((timestamp, index) => ({
          date: new Date(timestamp * 1000).toISOString().slice(0, 10),
          open: Number(payload.o?.[index]),
          high: Number(payload.h?.[index]),
          low: Number(payload.l?.[index]),
          close: Number(payload.c?.[index]),
          volume: Number(payload.v?.[index]),
        }))
        .filter((candle) => candle.date && Number.isFinite(candle.close) && candle.close > 0)
        .filter((candle) => isCompletedMarketDate(candle.date));

      if (candles.length < 200) throw new Error(`ข้อมูล Finnhub ${years} ปีน้อยเกินไป`);
      state.provider = `Finnhub daily candles ${years}Y`;
      return candles;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Finnhub ไม่มีข้อมูลกราฟ");
}

async function fetchFinnhubMarketCandles(config) {
  const token = state.finnhubKey;
  if (!token) throw new Error("ยังไม่มี Finnhub API key");

  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * 365 * 5;
  const url = `https://finnhub.io/api/v1/${config.endpoint}?symbol=${encodeURIComponent(config.symbol)}&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(token)}`;
  const payload = await fetchJson(url, config.label || "Finnhub market candles");
  if (payload?.s !== "ok" || !Array.isArray(payload.t)) throw new Error("Finnhub ไม่มีข้อมูลกราฟสำหรับสินทรัพย์นี้");

  const candles = payload.t
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: Number(payload.o?.[index]),
      high: Number(payload.h?.[index]),
      low: Number(payload.l?.[index]),
      close: Number(payload.c?.[index]),
      volume: Number(payload.v?.[index] || 0),
    }))
    .filter((candle) => candle.date && Number.isFinite(candle.close) && candle.close > 0)
    .filter((candle) => isCompletedMarketDate(candle.date));

  if (candles.length < 180) throw new Error("ข้อมูล Finnhub ย้อนหลังไม่พอ");
  state.provider = config.label || "Finnhub market candles";
  return candles;
}

async function fetchJson(url, providerName) {
  if (isYahooChartProvider(providerName)) {
    return fetchYahooChartJson(url, providerName);
  }

  try {
    const response = await fetchWithTimeout(url, { cache: "no-store" }, timeoutForProvider(providerName));
    if (!response.ok) throw new Error("direct request failed");
    state.provider = providerName;
    return response.json();
  } catch (error) {
    if (FAST_MODE || providerName.includes("Finnhub")) throw error;
    const text = await fetchViaProxy(url, `${providerName} via free CORS proxy`);
    return JSON.parse(text);
  }
}

function isYahooChartProvider(providerName) {
  return providerName.toLowerCase().includes("yahoo chart");
}

async function fetchYahooChartJson(url, providerName) {
  const direct = fetchDirectJson(url, providerName);
  const proxy = fetchProxyJson(url, `${providerName} via proxy`);
  return Promise.any([direct, proxy]);
}

async function fetchDirectJson(url, providerName) {
  const response = await fetchWithTimeout(url, { cache: "no-store" }, timeoutForProvider(providerName));
  if (!response.ok) throw new Error("direct request failed");
  state.provider = providerName;
  return response.json();
}

async function fetchProxyJson(url, providerName) {
  const text = await fetchViaProxy(url, providerName);
  return JSON.parse(text);
}

function timeoutForProvider(providerName) {
  const name = providerName.toLowerCase();
  if (name.includes("chart") || name.includes("candle")) return CHART_TIMEOUT_MS;
  return CHART_TIMEOUT_MS;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = CHART_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function isCompletedMarketDate(dateText) {
  const now = new Date();
  const nyParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type) => nyParts.find((part) => part.type === type)?.value;
  const nyDate = `${value("year")}-${value("month")}-${value("day")}`;
  const nyMinutes = Number(value("hour")) * 60 + Number(value("minute"));

  if (dateText !== nyDate) return true;
  return nyMinutes >= 16 * 60 + 10;
}

async function fetchText(url) {
  try {
    const response = await fetchWithTimeout(url, { cache: "no-store" }, CHART_TIMEOUT_MS);
    if (!response.ok) throw new Error("direct request failed");
    state.provider = "Stooq free daily data";
    return response.text();
  } catch (error) {
    return fetchViaProxy(url, "Stooq via free CORS proxy");
  }
}

async function fetchViaProxy(url, providerName) {
  const encoded = encodeURIComponent(url);
  const proxies = [
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://corsproxy.io/?${encoded}`,
    `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
  ];

  const text = await Promise.any(
    proxies.map((proxy) => fetchWithTimeout(proxy, { cache: "no-store" }, timeoutForProvider(providerName))
      .then((response) => {
        if (!response.ok) throw new Error("proxy request failed");
        return response.text();
      }))
  );
  state.provider = providerName;
  return text;
}

function parseStooqCsv(csv) {
  const rows = csv.trim().split(/\r?\n/).slice(1);
  return rows
    .map((row) => {
      const [date, open, high, low, close, volume] = row.split(",");
      return {
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      };
    })
    .filter((candle) => candle.date && Number.isFinite(candle.close) && candle.close > 0);
}

function sma(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    let sum = 0;
    for (let i = index - period + 1; i <= index; i += 1) sum += values[i];
    return sum / period;
  });
}

function ema(values, period) {
  const k = 2 / (period + 1);
  const output = [];
  let previous = null;

  values.forEach((value, index) => {
    if (index + 1 < period) {
      output.push(null);
      return;
    }
    if (previous === null) {
      const seed = values.slice(index - period + 1, index + 1).reduce((sum, item) => sum + item, 0) / period;
      previous = seed;
    } else {
      previous = value * k + previous * (1 - k);
    }
    output.push(previous);
  });

  return output;
}

function macd(values) {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine = values.map((_, index) => {
    if (ema12[index] === null || ema26[index] === null) return null;
    return ema12[index] - ema26[index];
  });
  const compactMacd = macdLine.filter((value) => value !== null);
  const signalCompact = ema(compactMacd, 9);
  const signal = [];
  let signalIndex = 0;
  macdLine.forEach((value) => {
    if (value === null) {
      signal.push(null);
    } else {
      signal.push(signalCompact[signalIndex] ?? null);
      signalIndex += 1;
    }
  });
  const histogram = macdLine.map((value, index) => {
    if (value === null || signal[index] === null) return null;
    return value - signal[index];
  });
  return { macdLine, signal, histogram };
}

function toWeeklyCandles(candles) {
  const weeks = [];
  let currentKey = "";
  let current = null;

  candles.forEach((candle) => {
    const date = new Date(`${candle.date}T00:00:00`);
    const weekStart = new Date(date);
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - day + 1);
    const key = weekStart.toISOString().slice(0, 10);

    if (key !== currentKey) {
      if (current) weeks.push(current);
      currentKey = key;
      current = { ...candle };
      return;
    }

    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume || 0;
    current.date = candle.date;
  });

  if (current) weeks.push(current);
  return weeks;
}

function uniqueLevels(levels) {
  const sorted = levels
    .filter((level) => Number.isFinite(level.value) && level.value > 0)
    .sort((a, b) => a.value - b.value);

  const output = [];
  sorted.forEach((level) => {
    const existing = output.find((item) => Math.abs(item.value - level.value) / level.value < 0.012);
    if (!existing) output.push(level);
  });
  return output;
}

function nearestPivots(candles) {
  const pivots = [];
  for (let i = 3; i < candles.length - 3; i += 1) {
    const slice = candles.slice(i - 3, i + 4);
    const isLow = candles[i].low === Math.min(...slice.map((c) => c.low));
    const isHigh = candles[i].high === Math.max(...slice.map((c) => c.high));
    if (isLow) pivots.push({ type: "support", value: candles[i].low, label: "pivot low" });
    if (isHigh) pivots.push({ type: "resistance", value: candles[i].high, label: "pivot high" });
  }
  return pivots.slice(-36);
}

function analyze(candles, lookback, riskMode, quote = null) {
  const scoped = candles.slice(-lookback);
  const weekly = toWeeklyCandles(candles);
  const weeklyCloses = weekly.map((candle) => candle.close);
  const weeklyMa50 = sma(weeklyCloses, 50).at(-1);
  const weeklyEma200 = ema(weeklyCloses, 200).at(-1);
  const closes = scoped.map((candle) => candle.close);
  const highs = scoped.map((candle) => candle.high);
  const lows = scoped.map((candle) => candle.low);
  const latest = scoped.at(-1);
  const displayPrice = latest.close;
  const last = displayPrice;
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const range = high - low;
  const fib = {
    "23.6": high - range * 0.236,
    "38.2": high - range * 0.382,
    "50.0": high - range * 0.5,
    "61.8": high - range * 0.618,
    "78.6": high - range * 0.786,
    "127.2": high + range * 0.272,
    "161.8": high + range * 0.618,
  };
  const ma50Series = sma(closes, 50);
  const ema200Series = ema(closes, 200);
  const macdData = macd(closes);
  const ma50 = ma50Series.at(-1);
  const ema200 = ema200Series.at(-1);
  const hist = macdData.histogram.at(-1);
  const previousHist = macdData.histogram.at(-2);
  const macdLine = macdData.macdLine.at(-1);
  const signal = macdData.signal.at(-1);
  const pivots = nearestPivots(scoped);

  const supportCandidates = uniqueLevels([
    { value: weeklyMa50, label: "MA50 Week" },
    { value: weeklyEma200, label: "EMA200 Week" },
    ...pivots.filter((pivot) => pivot.type === "support").map((pivot) => ({ ...pivot, label: "backup pivot" })),
  ]);
  const resistanceCandidates = uniqueLevels([
    { value: fib["23.6"], label: "Fib 23.6%" },
    { value: fib["38.2"], label: "Fib 38.2%" },
    { value: fib["50.0"], label: "Fib 50%" },
    { value: fib["61.8"], label: "Fib 61.8%" },
    { value: high, label: "High เดิม" },
    { value: fib["127.2"], label: "Fib Extension 127.2%" },
    { value: fib["161.8"], label: "Fib Extension 161.8%" },
    ...pivots.filter((pivot) => pivot.type === "resistance").map((pivot) => ({ ...pivot, label: "backup high" })),
  ]);

  const supports = pickTwoLevels(supportCandidates, last, "support");
  const resistances = pickTwoLevels(resistanceCandidates, last, "resistance");
  while (supports.length < 2) {
    const step = supports.length + 1;
    supports.push({ value: last * (1 - step * 0.08), label: "price band" });
  }
  while (resistances.length < 2) {
    const step = resistances.length + 1;
    resistances.push({ value: last * (1 + step * 0.08), label: "price band" });
  }

  const deepBias = riskMode === "patient" ? fib["78.6"] : fib["61.8"];
  const upperBias = riskMode === "momentum" ? fib["38.2"] : fib["50.0"];
  const zoneTop = Math.max(Math.min(upperBias, last * 1.04), deepBias);
  const zoneBottom = Math.min(deepBias, zoneTop);

  let score = 0;
  if (last <= fib["50.0"] && last >= fib["61.8"]) score += 40;
  else if (last <= fib["61.8"] && last >= fib["78.6"]) score += 35;
  else if (last <= fib["38.2"] && last >= fib["50.0"]) score += 20;
  else if (last < fib["78.6"]) score += 15;

  const emaDistance = ((last - ema200) / ema200) * 100;
  if (Math.abs(emaDistance) <= 7) score += 25;
  else if (emaDistance < 0 && emaDistance >= -15) score += 15;
  else if (emaDistance > 0 && emaDistance <= 20) score += 10;
  else score += 5;

  const maDistance = ((last - ma50) / ma50) * 100;
  if (last > ma50 && scoped.at(-2).close <= ma50Series.at(-2)) score += 15;
  else if (Math.abs(maDistance) <= 5) score += 10;
  else if (last > ma50) score += 8;
  else score += 3;

  if (macdLine > signal && hist > 0) score += 20;
  else if (hist > previousHist) score += 15;
  else if (hist > 0) score += 10;

  score = Math.min(100, Math.round(score));
  const trendState = last > ema200 && last > ma50 ? "ขาขึ้นแข็งแรง" : last > ema200 ? "ฐานใหญ่ยังดี" : "กำลังพักฐาน";
  const macdState = macdLine > signal ? "ตัดขึ้น" : hist > previousHist ? "เริ่มฟื้น" : "ยังอ่อน";

  return {
    scoped,
    closes,
    latest,
    displayPrice,
    quote: null,
    high,
    low,
    fib,
    ma50Series,
    ema200Series,
    macdData,
    ma50,
    ema200,
    supports,
    resistances,
    zoneBottom,
    zoneTop,
    score,
    trendState,
    macdState,
    emaDistance,
    weeklyMa50,
    weeklyEma200,
  };
}

function pickTwoLevels(candidates, last, kind) {
  const belowOrNear = candidates
    .filter((level) => kind === "support" ? level.value <= last * 1.025 : level.value >= last * 0.975)
    .sort((a, b) => kind === "support" ? b.value - a.value : a.value - b.value);

  const output = belowOrNear.slice(0, 2);
  const fallback = candidates
    .filter((level) => !output.some((item) => item.label === level.label && item.value === level.value))
    .sort((a, b) => Math.abs(a.value - last) - Math.abs(b.value - last));

  while (output.length < 2 && fallback.length) output.push(fallback.shift());
  return output;
}

function renderLists(analysis) {
  const supportNames = ["แนวรับ 1", "แนวรับ 2"];
  const resistanceNames = ["แนวต้าน 1", "แนวต้าน 2"];
  $("supportList").innerHTML = analysis.supports
    .map((level, index) => `<li><b>${supportNames[index]} ${money(level.value)}</b></li>`)
    .join("");
  $("resistanceList").innerHTML = analysis.resistances
    .map((level, index) => `<li><b>${resistanceNames[index]} ${money(level.value)}</b></li>`)
    .join("");
}

function updateSummary(symbol, analysis, isSample) {
  $("chartTitle").textContent = symbol;
  $("lastPrice").textContent = money(analysis.displayPrice);
  $("lastPriceDate").textContent = `ปิดตลาด ${formatMarketDate(analysis.latest.date)}`;
  $("trendState").textContent = analysis.trendState;
  $("accumulationZone").textContent = `${money(analysis.zoneBottom)} - ${money(analysis.zoneTop)}`;
  $("fiboSummary").textContent = `${money(analysis.fib["50.0"])} / ${money(analysis.fib["61.8"])}`;
  $("macdSummary").textContent = analysis.macdState;
  $("macdDetail").textContent = `คะแนนสะสม ${analysis.score}/100, MACD histogram ล่าสุด ${analysis.macdData.histogram.at(-1).toFixed(3)}`;

  const scoreText = analysis.score >= 80 ? "โซนสะสมแข็งแรง" : analysis.score >= 60 ? "เริ่มน่าสนใจ" : analysis.score >= 40 ? "รอดูต่อ" : "ยังไม่เข้าเงื่อนไข";
  if (isSample) {
    $("zoneReason").textContent = `${scoreText}: กราฟตัวอย่างอิงราคาล่าสุด ใช้ดูภาพรวมเบื้องต้น`;
  } else {
    $("zoneReason").textContent = `${scoreText}: ราคาอยู่ห่าง EMA200 ${pct(analysis.emaDistance)} และเทรนด์คือ ${analysis.trendState}`;
  }
  $("statusPill").textContent = isSample ? "ข้อมูลตัวอย่าง" : "ราคาปิดล่าสุด";
  $("dataSource").textContent = state.instrument?.label ? `${state.provider} · ${state.instrument.label}` : state.provider;
  renderLists(analysis);
}

function drawChart() {
  const canvas = $("priceChart");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const isMobile = window.innerWidth <= 620;
  const pad = isMobile
    ? { top: 18, right: 124, bottom: 32, left: 66 }
    : { top: 24, right: 172, bottom: 34, left: 78 };
  ctx.clearRect(0, 0, width, height);

  if (!state.analysis) return;
  const a = state.analysis;
  const values = [
    ...a.scoped.map((c) => c.close),
    ...a.supports.map((l) => l.value),
    ...a.resistances.map((l) => l.value),
    a.zoneBottom,
    a.zoneTop,
    a.ma50,
    a.ema200,
  ].filter(Number.isFinite);
  const min = Math.min(...values) * 0.97;
  const max = Math.max(...values) * 1.03;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index) => pad.left + (index / (a.scoped.length - 1)) * plotW;
  const y = (value) => pad.top + ((max - value) / (max - min)) * plotH;

  ctx.fillStyle = "#fbfcfb";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e3e7e2";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6b777c";
  ctx.font = "12px Arial";
  for (let i = 0; i <= 4; i += 1) {
    const yy = pad.top + (plotH / 4) * i;
    const value = max - ((max - min) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(width - pad.right, yy);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(money(value), pad.left - 10, yy + 4);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(22, 113, 95, 0.12)";
  ctx.fillRect(pad.left, y(a.zoneTop), plotW, Math.max(4, y(a.zoneBottom) - y(a.zoneTop)));

  drawSmoothLine(ctx, smoothDisplaySeries(a.scoped.map((c) => c.close), DISPLAY_SMOOTH_DAYS), x, y, "#2f68a3", 2.4);
  drawLine(ctx, a.ma50Series, x, y, "#b78426", 1.8);
  drawLine(ctx, a.ema200Series, x, y, "#16715f", 1.8);

  const supportLabels = a.supports.map((level, index) => ({
    ...level,
    code: window.innerWidth <= 620 ? `รับ ${index + 1}` : `แนวรับ ${index + 1}`,
    kind: "support",
  }));
  const resistanceLabels = a.resistances.map((level, index) => ({
    ...level,
    code: window.innerWidth <= 620 ? `ต้าน ${index + 1}` : `แนวต้าน ${index + 1}`,
    kind: "resistance",
  }));
  const allLevelLabels = [...supportLabels, ...resistanceLabels];

  allLevelLabels.forEach((level) => {
    const isSupport = level.kind === "support";
    ctx.strokeStyle = isSupport ? "rgba(22, 113, 95, 0.48)" : "rgba(179, 71, 71, 0.48)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y(level.value));
    ctx.lineTo(width - pad.right, y(level.value));
    ctx.stroke();
    ctx.setLineDash([]);
  });

  drawLevelBadges(ctx, allLevelLabels, y, width - pad.right, pad.top, pad.top + plotH);

  ctx.fillStyle = "#152026";
  ctx.font = "700 12px Arial";
  ctx.fillText(a.scoped[0].date, pad.left, height - 12);
  ctx.fillText(a.latest.date, width - pad.right - 72, height - 12);
}

function drawLevelBadges(ctx, levels, y, rightEdge, minY, maxY) {
  const badges = levels
    .map((level) => ({
      ...level,
      y: y(level.value),
      targetY: y(level.value),
    }))
    .sort((a, b) => a.y - b.y);

  const badgeHeight = 22;
  const gap = 5;
  badges.forEach((badge, index) => {
    if (index === 0) {
      badge.y = Math.max(minY + badgeHeight / 2, badge.y);
      return;
    }
    const previous = badges[index - 1];
    badge.y = Math.max(badge.y, previous.y + badgeHeight + gap);
  });

  for (let index = badges.length - 1; index >= 0; index -= 1) {
    const badge = badges[index];
    if (badge.y > maxY - badgeHeight / 2) badge.y = maxY - badgeHeight / 2;
    if (index < badges.length - 1) {
      const next = badges[index + 1];
      badge.y = Math.min(badge.y, next.y - badgeHeight - gap);
    }
    badge.y = Math.max(minY + badgeHeight / 2, badge.y);
  }

  badges.forEach((badge) => {
    const isSupport = badge.kind === "support";
    const boxWidth = window.innerWidth <= 620 ? 96 : 136;
    const boxX = rightEdge + 8;
    const boxY = badge.y - badgeHeight / 2;
    const color = isSupport ? "#16715f" : "#b34747";

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rightEdge - 18, badge.targetY);
    ctx.lineTo(boxX, badge.y);
    ctx.stroke();

    ctx.fillStyle = isSupport ? "rgba(22, 113, 95, 0.14)" : "rgba(179, 71, 71, 0.13)";
    ctx.strokeStyle = isSupport ? "rgba(22, 113, 95, 0.62)" : "rgba(179, 71, 71, 0.62)";
    roundRect(ctx, boxX, boxY, boxWidth, badgeHeight, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = window.innerWidth <= 620 ? "700 10px Arial" : "700 11px Arial";
    ctx.fillText(`${badge.code} ${money(badge.value)}`, boxX + 8, badge.y + 4);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLine(ctx, series, x, y, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  let started = false;
  series.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    if (!started) {
      ctx.moveTo(x(index), y(value));
      started = true;
    } else {
      ctx.lineTo(x(index), y(value));
    }
  });
  ctx.stroke();
}

function drawSmoothLine(ctx, series, x, y, color, lineWidth) {
  const points = series
    .map((value, index) => Number.isFinite(value) ? { x: x(index), y: y(value) } : null)
    .filter(Boolean);

  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  const last = points.at(-1);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function smoothDisplaySeries(series, period) {
  if (period <= 1) return series;
  const output = [];
  for (let index = 0; index < series.length; index += 1) {
    if (!Number.isFinite(series[index])) {
      output.push(null);
      continue;
    }
    const start = Math.max(0, index - period + 1);
    const slice = series.slice(start, index + 1).filter(Number.isFinite);
    output.push(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  }
  if (Number.isFinite(series.at(-1))) output[output.length - 1] = series.at(-1);
  return output;
}

async function loadRealCandles(symbol, instrument = state.instrument) {
  const errors = [];
  const yahooSymbols = instrument?.dataSymbols?.length ? instrument.dataSymbols : [symbol];

  for (const yahooSymbol of yahooSymbols) {
    try {
      const candles = await fetchYahoo(yahooSymbol);
      setCachedCandles(symbol, candles);
      if (yahooSymbol !== symbol) setCachedCandles(yahooSymbol, candles);
      state.provider = yahooSymbol === symbol ? "Yahoo daily close" : `Yahoo daily close (${yahooSymbol})`;
      return candles;
    } catch (error) {
      errors.push(`Yahoo ${yahooSymbol}: ${error.message}`);
    }
  }

  if (instrument?.finnhub) {
    try {
      const candles = await fetchFinnhubMarketCandles(instrument.finnhub);
      setCachedCandles(symbol, candles);
      return candles;
    } catch (error) {
      errors.push(`${instrument.finnhub.label || "Finnhub"}: ${error.message}`);
    }
  }

  for (const yahooSymbol of instrument?.fallbackDataSymbols || []) {
    try {
      const candles = await fetchYahoo(yahooSymbol);
      setCachedCandles(symbol, candles);
      setCachedCandles(yahooSymbol, candles);
      state.provider = `Yahoo fallback daily close (${yahooSymbol})`;
      return candles;
    } catch (error) {
      errors.push(`Yahoo fallback ${yahooSymbol}: ${error.message}`);
    }
  }

  if (instrument?.yahooOnly) {
    throw new Error(errors.join(" | "));
  }

  try {
    const candles = await fetchStooq(symbol);
    setCachedCandles(symbol, candles);
    state.provider = "Stooq daily close";
    return candles;
  } catch (error) {
    errors.push(`Stooq: ${error.message}`);
  }

  try {
    const candles = await fetchFinnhubCandles(symbol);
    setCachedCandles(symbol, candles);
    state.provider = "Finnhub daily close";
    return candles;
  } catch (error) {
    errors.push(`Finnhub: ${error.message}`);
  }

  throw new Error(errors.join(" | "));
}

function renderLoadError(symbol) {
  $("chartTitle").textContent = symbol;
  $("lastPrice").textContent = "-";
  $("lastPriceDate").textContent = "โหลดราคาปิดล่าสุดไม่ได้";
  $("trendState").textContent = "-";
  $("accumulationZone").textContent = "-";
  $("zoneReason").textContent = "ยังโหลด daily candles จริงไม่ได้ จึงไม่คำนวณโซนสะสม";
  $("macdSummary").textContent = "-";
  $("macdDetail").textContent = "ต้องมีข้อมูลกราฟจริงก่อนจึงคำนวณ MACD ได้";
  $("supportList").innerHTML = "";
  $("resistanceList").innerHTML = "";
  $("statusPill").textContent = "โหลดข้อมูลไม่ได้";
  $("dataSource").textContent = "Real daily data unavailable";
  drawMessageChart("โหลดกราฟราคาจริงไม่ได้");
}

function drawMessageChart(message) {
  const canvas = $("priceChart");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#fbfcfb";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#61727c";
  ctx.font = "700 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(message, rect.width / 2, rect.height / 2);
  ctx.textAlign = "left";
}

async function runAnalysis(symbol = state.symbol) {
  const instrument = resolveInstrument(symbol);
  const cleanSymbol = instrument.dataSymbol;
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  state.symbol = cleanSymbol;
  state.displaySymbol = instrument.displaySymbol;
  state.instrument = instrument;
  $("statusPill").textContent = "กำลังโหลด...";

  let candles = getCachedCandles(cleanSymbol);

  if (candles) {
    state.provider = "Cached real daily close";
  } else {
    try {
      candles = await loadRealCandles(cleanSymbol, instrument);
    } catch (error) {
      if (requestId !== state.requestId) return;
      renderLoadError(state.displaySymbol);
      return;
    }
  }

  const lookback = Number($("lookbackSelect").value);
  const riskMode = $("riskSelect").value;
  if (requestId !== state.requestId) return;
  state.candles = candles;
  state.quote = null;
  state.analysis = analyze(candles, lookback, riskMode, null);
  updateSummary(state.displaySymbol, state.analysis, false);
  drawChart();
}

$("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  runAnalysis($("symbolInput").value);
});

document.querySelectorAll("[data-symbol]").forEach((button) => {
  button.addEventListener("click", () => {
    const symbol = button.dataset.symbol;
    $("symbolInput").value = symbol;
    runAnalysis(symbol);
  });
});

$("lookbackSelect").addEventListener("change", () => runAnalysis(state.symbol));
$("riskSelect").addEventListener("change", () => runAnalysis(state.symbol));
window.addEventListener("resize", drawChart);

state.finnhubKey = getFinnhubKey();
runAnalysis("AAPL");
