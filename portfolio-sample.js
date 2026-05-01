const $ = (id) => document.getElementById(id);

const SLEEVES = {
  growth: {
    label: "Growth",
    description: "AI, semiconductor, electrification และธุรกิจที่โตตาม capex รอบใหญ่",
    color: "#3c6f92",
  },
  diversified: {
    label: "Diversified",
    description: "กระจายประเทศและลดการพึ่งพาตลาดเดียว",
    color: "#6f6b9d",
  },
  hedge: {
    label: "Hedge & Defense",
    description: "ทองคำ พลังงาน อาหาร cyber หุ้นจำเป็น และ defense",
    color: "#b18a3b",
  },
  cash: {
    label: "Cash / T-Bill",
    description: "เงินพักและกระสุนสำรองสำหรับตลาดตก",
    color: "#2f7668",
  },
  unknown: {
    label: "รอจัดกลุ่ม",
    description: "จะระบุอัตโนมัติเมื่อเชื่อมข้อมูล sector/industry",
    color: "#aa6657",
  },
};

const SLEEVE_ORDER = ["cash", "hedge", "growth", "diversified", "unknown"];

const PROFILES = {
  low: {
    label: "เสี่ยงต่ำ",
    targets: { growth: 25, diversified: 10, hedge: 35, cash: 30 },
  },
  balanced: {
    label: "เสี่ยงกลาง",
    targets: { growth: 40, diversified: 7, hedge: 33, cash: 20 },
  },
  high: {
    label: "เสี่ยงสูง",
    targets: { growth: 58, diversified: 7, hedge: 25, cash: 10 },
  },
};

const BASE_TARGETS = {
  PLTR: 8,
  MRVL: 8,
  MU: 8,
  TSLA: 6,
  ESLT: 5,
  TSEM: 5,
  EWJ: 7,
  OXY: 7,
  CF: 5,
  VG: 5,
  ORA: 3,
  CHKP: 3,
  IAU: 10,
  SGOV: 20,
};

const ALIASES = {
  BRKB: "BRK.B",
  "BRK.B": "BRK.B",
  "BRK-B": "BRK.B",
  DRAM: "MU",
  FB: "META",
  GOLD: "IAU",
  GLD: "IAU",
  CASH: "SGOV",
  TBILL: "SGOV",
  "T-BILL": "SGOV",
};

const LOCAL_ASSET_DB = typeof window !== "undefined" && window.DADDY_ASSET_DB ? window.DADDY_ASSET_DB : {
  sectors: {},
  industries: {},
  assets: {},
};
const API_CONFIG = typeof window !== "undefined" && window.DADDY_API_CONFIG ? window.DADDY_API_CONFIG : {};
const ASSET_API_ENDPOINT = API_CONFIG.assetEndpoint || "";
const API_LOOKUP_DELAY_MS = 380;
const API_ASSET_CACHE = new Map();
const API_LOOKUP_IN_FLIGHT = new Set();
let apiLookupTimer = 0;
const INDEX_LABELS = {
  SP500: "S&P 500",
  RUSSELL2000: "Russell 2000",
};

const SAMPLE_API_ASSETS = {
  ADP: {
    name: "Automatic Data Processing",
    sector: "Industrials",
    industry: "Human Capital Management / Business Services",
    sleeve: "diversified",
    beta: 0.8,
    source: "sample API",
  },
  APP: {
    name: "AppLovin",
    sector: "Information Technology",
    industry: "Software / Advertising Technology",
    sleeve: "growth",
    beta: 1.5,
    source: "sample API",
  },
  DECK: {
    name: "Deckers Outdoor",
    sector: "Consumer Discretionary",
    industry: "Footwear & Apparel",
    sleeve: "growth",
    beta: 1.1,
    source: "sample API",
  },
  MCD: {
    name: "McDonald's",
    sector: "Consumer Discretionary",
    industry: "Restaurants / Defensive Franchise",
    sleeve: "hedge",
    beta: 0.7,
    source: "sample API",
  },
  NEM: {
    name: "Newmont",
    sector: "Materials",
    industry: "Gold Mining",
    sleeve: "hedge",
    beta: 0.6,
    source: "sample API",
  },
  ROK: {
    name: "Rockwell Automation",
    sector: "Industrials",
    industry: "Industrial Automation",
    sleeve: "growth",
    beta: 1.1,
    source: "sample API",
  },
  RSG: {
    name: "Republic Services",
    sector: "Industrials",
    industry: "Waste Management / Environmental Services",
    sleeve: "hedge",
    beta: 0.7,
    source: "sample API",
  },
  SHOP: {
    name: "Shopify",
    sector: "Information Technology",
    industry: "E-Commerce Software",
    sleeve: "growth",
    beta: 1.4,
    source: "sample API",
  },
  TTD: {
    name: "The Trade Desk",
    sector: "Communication Services",
    industry: "Advertising Technology",
    sleeve: "growth",
    beta: 1.5,
    source: "sample API",
  },
  URI: {
    name: "United Rentals",
    sector: "Industrials",
    industry: "Equipment Rental / Cyclical Industrials",
    sleeve: "diversified",
    beta: 1.3,
    source: "sample API",
  },
  VRSK: {
    name: "Verisk Analytics",
    sector: "Industrials",
    industry: "Data Analytics / Insurance Services",
    sleeve: "diversified",
    beta: 0.8,
    source: "sample API",
  },
};

const INDUSTRY_TAXONOMY = [
  {
    sleeve: "cash",
    label: "Cash / T-Bill",
    sources: ["assetType", "industry", "name"],
    keywords: [
      "cash",
      "money market",
      "treasury bill",
      "t-bill",
      "short-term treasury",
      "ultra short",
      "0-3 month treasury",
      "government money market",
    ],
  },
  {
    sleeve: "hedge",
    label: "Hedge & Defense",
    sources: ["sector", "industry", "description"],
    keywords: [
      "consumer staples",
      "household products",
      "personal products",
      "beverages",
      "packaged foods",
      "food products",
      "health care distributors",
      "managed health care",
      "pharmaceuticals",
      "waste management",
      "environmental services",
      "telecommunication",
      "defensive franchise",
      "restaurants",
      "regulated electric",
      "regulated gas",
      "utilities",
      "aerospace and defense",
      "defense",
      "cybersecurity",
      "oil and gas",
      "integrated oil",
      "exploration and production",
      "liquefied natural gas",
      "midstream",
      "energy security",
      "fertilizer",
      "agricultural inputs",
      "gold",
      "precious metals",
      "commodities",
    ],
  },
  {
    sleeve: "growth",
    label: "Growth",
    sources: ["sector", "industry", "description"],
    keywords: [
      "software",
      "cloud",
      "semiconductors",
      "semiconductor",
      "artificial intelligence",
      "advertising technology",
      "data center",
      "electrification",
      "power grid",
      "grid infrastructure",
      "electrical equipment",
      "energy equipment",
      "renewable power",
      "geothermal",
      "solar",
      "automation",
      "robotics",
      "electric vehicle",
      "biotechnology",
      "medical technology",
      "fintech",
      "internet retail",
      "e-commerce software",
      "industrial automation",
      "semiconductor equipment",
    ],
  },
  {
    sleeve: "diversified",
    label: "Diversified",
    sources: ["assetType", "industry", "name", "description"],
    keywords: [
      "broad market",
      "index fund",
      "global equity",
      "international equity",
      "country etf",
      "regional etf",
      "multi-sector",
      "msci",
      "s&p 500",
      "total market",
      "capital markets",
      "business services",
      "banks",
      "insurance",
      "reit",
      "real estate",
      "railroad",
      "transportation",
    ],
  },
];

const ASSET_MAP = {
  PLTR: {
    name: "Palantir",
    sleeve: "growth",
    theme: "AI Software / Government AI",
    industry: "Software infrastructure",
    risk: 82,
    note: "โตจาก AI และภาครัฐ แต่ valuation แกว่งแรงได้",
  },
  MRVL: {
    name: "Marvell",
    sleeve: "growth",
    theme: "AI Infrastructure / Custom chip",
    industry: "Semiconductors",
    risk: 76,
    note: "ผูกกับ data center และวัฏจักรชิป",
  },
  MU: {
    name: "Micron",
    sleeve: "growth",
    theme: "DRAM / HBM memory",
    industry: "Memory semiconductors",
    risk: 78,
    note: "ได้แรงจาก AI server แต่ cycle memory ผันผวนสูง",
  },
  TSLA: {
    name: "Tesla",
    sleeve: "growth",
    theme: "Physical AI / Robotaxi / Energy",
    industry: "Auto and energy technology",
    risk: 88,
    note: "โอกาสสูง แต่เสี่ยง margin รถยนต์และความคาดหวัง robotaxi",
  },
  ESLT: {
    name: "Elbit Systems",
    sleeve: "hedge",
    theme: "Defense technology / Geopolitical hedge",
    industry: "Aerospace and defense",
    risk: 64,
    note: "เกี่ยวกับงบกลาโหมและความเสี่ยงภูมิรัฐศาสตร์ จัดเป็น Hedge & Defense มากกว่า Growth ล้วน",
  },
  TSEM: {
    name: "Tower Semiconductor",
    sleeve: "growth",
    theme: "Specialty foundry",
    industry: "Semiconductor foundry",
    risk: 73,
    note: "ช่วยกระจาย supply chain แต่ยังอยู่ในวัฏจักร semiconductor",
  },
  EWJ: {
    name: "iShares MSCI Japan ETF",
    sleeve: "diversified",
    theme: "Japan diversification",
    industry: "Japan equity ETF",
    risk: 55,
    note: "กระจายออกจากสหรัฐ แต่ยังเป็นหุ้นและลงได้ใน recession",
  },
  OXY: {
    name: "Occidental Petroleum",
    sleeve: "hedge",
    theme: "Oil / Inflation hedge",
    industry: "Oil and gas",
    risk: 63,
    note: "ช่วยรับมือพลังงานแพง แต่ขึ้นกับราคาน้ำมัน",
  },
  CF: {
    name: "CF Industries",
    sleeve: "hedge",
    theme: "Fertilizer / Food security",
    industry: "Agricultural inputs",
    risk: 58,
    note: "เกี่ยวกับปุ๋ยและอาหาร แต่สินค้าโภคภัณฑ์ยังผันผวน",
  },
  VG: {
    name: "Venture Global",
    sleeve: "hedge",
    theme: "LNG / Energy security",
    industry: "Liquefied natural gas",
    risk: 80,
    note: "มีโอกาสจาก LNG แต่เสี่ยงโครงการ หนี้ และ execution",
  },
  ORA: {
    name: "Ormat Technologies",
    sleeve: "growth",
    theme: "Geothermal / Power infrastructure growth",
    industry: "Renewable power infrastructure",
    risk: 50,
    note: "เติบโตจากไฟฟ้าฐานและ geothermal แต่ใช้เงินลงทุนสูงและโตไม่เร็ว",
  },
  CHKP: {
    name: "Check Point Software",
    sleeve: "hedge",
    theme: "Cyber defense",
    industry: "Cybersecurity",
    risk: 48,
    note: "margin ดีและมีกำไรจริง แต่โตช้ากว่าหุ้น cyber รุ่นใหม่",
  },
  IAU: {
    name: "iShares Gold Trust",
    sleeve: "hedge",
    theme: "Gold / Crisis hedge",
    industry: "Gold ETF",
    risk: 35,
    note: "กันสงคราม เงินเฟ้อ ค่าเงิน และความไม่มั่นใจในระบบการเงิน",
  },
  SGOV: {
    name: "iShares 0-3 Month Treasury Bond ETF",
    sleeve: "cash",
    theme: "Cash reserve / T-Bill",
    industry: "Short-term Treasury ETF",
    risk: 10,
    note: "เงินพักและกระสุนสำรอง ไม่ใช่ตัวเร่งการเติบโต",
  },
  NVDA: {
    name: "NVIDIA",
    sleeve: "growth",
    theme: "AI GPU / Accelerated computing",
    industry: "Semiconductors",
    risk: 86,
    note: "ตัวแทน AI โดยตรง แต่ valuation และ cycle ลงแรงได้",
  },
  MSFT: {
    name: "Microsoft",
    sleeve: "growth",
    theme: "AI cloud / Enterprise software",
    industry: "Software and cloud",
    risk: 60,
    note: "คุณภาพสูงกว่า growth หลายตัว แต่ยังขึ้นกับ valuation หุ้นใหญ่",
  },
  AAPL: {
    name: "Apple",
    sleeve: "growth",
    theme: "Consumer technology",
    industry: "Hardware and services",
    risk: 58,
    note: "ฐานธุรกิจแข็งแรง แต่ growth อาจไม่แรงเท่าธีม AI โดยตรง",
  },
  XOM: {
    name: "Exxon Mobil",
    sleeve: "hedge",
    theme: "Oil / Energy hedge",
    industry: "Integrated oil and gas",
    risk: 54,
    note: "ใช้แทน exposure พลังงานได้ แต่ยังผูกกับราคาน้ำมัน",
  },
  PG: {
    name: "Procter & Gamble",
    sleeve: "hedge",
    theme: "Consumer staples / Defensive equity",
    industry: "Household and personal products",
    risk: 36,
    note: "รายได้ค่อนข้างทนวัฏจักรเพราะเป็นสินค้าอุปโภคบริโภคจำเป็น แต่ยังเป็นหุ้นและมี valuation risk",
  },
  GEV: {
    name: "GE Vernova",
    sleeve: "growth",
    theme: "Power grid / Electrification growth",
    industry: "Energy equipment and power infrastructure",
    risk: 68,
    note: "ได้แรงจากไฟฟ้า โครงข่าย และ energy transition แต่ยังมี execution และวัฏจักรอุตสาหกรรม",
  },
};

let selectedProfile = "balanced";
let assetRows = [];
const UNSAVED_EXIT_WARNING = "ระบบยังไม่สามารถบันทึก รบกวน Capture หน้าจอ";

const SAMPLE_ASSETS = [
  { symbol: "PLTR", amount: 8000 },
  { symbol: "MRVL", amount: 8000 },
  { symbol: "MU", amount: 8000 },
  { symbol: "TSLA", amount: 6000 },
  { symbol: "ESLT", amount: 5000 },
  { symbol: "TSEM", amount: 5000 },
  { symbol: "EWJ", amount: 7000 },
  { symbol: "OXY", amount: 7000 },
  { symbol: "CF", amount: 5000 },
  { symbol: "VG", amount: 5000 },
  { symbol: "ORA", amount: 3000 },
  { symbol: "CHKP", amount: 3000 },
  { symbol: "IAU", amount: 10000 },
  { symbol: "SGOV", amount: 20000 },
];

function normalizeTicker(rawTicker) {
  const ticker = rawTicker.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return ALIASES[ticker] || ticker;
}

function getHoldingsFromRows() {
  const merged = new Map();
  assetRows.forEach((row) => {
    const symbol = normalizeTicker(row.symbol);
    const valueUsd = Number(row.amount);
    if (!symbol || !Number.isFinite(valueUsd) || valueUsd <= 0) return;
    const current = merged.get(symbol) || 0;
    merged.set(symbol, current + valueUsd);
  });

  return [...merged.entries()].map(([symbol, valueUsd]) => ({
    symbol,
    valueUsd,
    weight: valueUsd,
    ...resolveAsset(symbol),
  }));
}

function resolveAsset(symbol) {
  const apiMeta = assetFromApiCache(symbol);
  const localMeta = assetFromLocalDb(symbol);
  const manualMeta = ASSET_MAP[symbol];
  const baseMeta = apiMeta || localMeta;
  if (manualMeta) {
    return {
      ...(baseMeta || {}),
      ...manualMeta,
      sector: manualMeta.sector || baseMeta?.sector || "",
      industry: manualMeta.industry || baseMeta?.industry || "",
      source: baseMeta ? `override + ${baseMeta.source}` : "manual override",
    };
  }
  return apiMeta || localMeta || unknownAsset(symbol);
}

function assetFromLocalDb(symbol) {
  const row = LOCAL_ASSET_DB.assets?.[symbol];
  if (!row) return null;

  const [name, sectorCode, industryCode, sleeveOverride, risk = 60, assetTypeOrIndexes = "Stock", indexTags = []] = row;
  const assetType = Array.isArray(assetTypeOrIndexes) ? "Stock" : assetTypeOrIndexes;
  const indexes = Array.isArray(assetTypeOrIndexes) ? assetTypeOrIndexes : indexTags;
  const sector = LOCAL_ASSET_DB.sectors?.[sectorCode] || sectorCode || "";
  const industry = LOCAL_ASSET_DB.industries?.[industryCode] || industryCode || "";
  const profile = { name, sector, industry, assetType };
  const sleeve = sleeveOverride || classifyIndustryProfile(profile);

  return {
    name,
    sleeve,
    sector,
    industry,
    assetType,
    indexes,
    theme: industry || sector || "US listed asset",
    risk,
    note: `${name} ถูกจัดกลุ่มจากฐานข้อมูล local ตาม sector/industry`,
    source: "local DB",
  };
}

function assetFromApiCache(symbol) {
  const cached = API_ASSET_CACHE.get(symbol);
  if (!cached || cached.status !== "ok") return null;
  return cached.data;
}

function shouldUseApi(symbol) {
  return Boolean(ASSET_API_ENDPOINT && symbol && !ASSET_MAP[symbol] && !assetFromLocalDb(symbol));
}

function isSampleApiMode() {
  return ASSET_API_ENDPOINT === "sample";
}

function scheduleApiLookup(symbol) {
  if (!shouldUseApi(symbol)) return;
  window.clearTimeout(apiLookupTimer);
  apiLookupTimer = window.setTimeout(() => lookupAssetFromApi(symbol), API_LOOKUP_DELAY_MS);
}

async function lookupAssetFromApi(symbol) {
  if (!shouldUseApi(symbol)) return null;

  const current = API_ASSET_CACHE.get(symbol);
  if (current?.status === "ok" || current?.status === "missing" || current?.status === "error") {
    return current.data || null;
  }
  if (API_LOOKUP_IN_FLIGHT.has(symbol)) return null;

  API_LOOKUP_IN_FLIGHT.add(symbol);
  API_ASSET_CACHE.set(symbol, { status: "loading" });
  renderLookupHint();

  try {
    const payload = isSampleApiMode() ? SAMPLE_API_ASSETS[symbol] : await fetchAssetPayload(symbol);
    const data = payload ? normalizeApiAsset(symbol, payload) : null;

    API_ASSET_CACHE.set(symbol, data ? { status: "ok", data } : { status: "missing" });
    return data;
  } catch (error) {
    API_ASSET_CACHE.set(symbol, { status: "error" });
    return null;
  } finally {
    API_LOOKUP_IN_FLIGHT.delete(symbol);
    renderLookupHint();
    renderEntryTable();
    runAnalysis();
  }
}

async function fetchAssetPayload(symbol) {
  const url = new URL(ASSET_API_ENDPOINT);
  url.searchParams.set("ticker", symbol);
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  return response.ok ? response.json().catch(() => null) : null;
}

function normalizeApiAsset(symbol, payload) {
  const name = payload.name || payload.companyName || payload.symbol || symbol;
  const sector = payload.sector || "";
  const industry = payload.industry || "";
  const assetType = payload.assetType || (payload.isEtf ? "ETF" : "Stock");
  if (!sector && !industry) return null;

  const sleeve = payload.sleeve || classifyIndustryProfile({
    assetType,
    sector,
    industry,
    name,
    description: payload.description,
  });

  return {
    name,
    sleeve,
    sector,
    industry,
    assetType,
    theme: industry || sector,
    risk: Number(payload.risk) || estimateRisk(sleeve, payload.beta),
    note: `${name} ถูกจัดกลุ่มจาก API ตาม sector/industry`,
    source: payload.source || "api",
  };
}

function estimateRisk(sleeve, beta) {
  const base = {
    cash: 10,
    hedge: 46,
    diversified: 56,
    growth: 72,
    unknown: 72,
  }[sleeve] || 72;
  const betaValue = Number(beta);
  if (!Number.isFinite(betaValue) || betaValue <= 0) return base;
  return Math.max(10, Math.min(90, Math.round(base + (betaValue - 1) * 12)));
}

function classifyIndustryProfile(profile = {}) {
  const searchable = [
    profile.assetType,
    profile.sector,
    profile.industry,
    profile.name,
    profile.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const match = INDUSTRY_TAXONOMY.find((rule) => {
    return rule.keywords.some((keyword) => searchable.includes(keyword));
  });

  return match?.sleeve || "unknown";
}

function unknownAsset(symbol) {
  return {
    name: "รอเชื่อมข้อมูล",
    sleeve: "unknown",
    theme: "Unknown sector",
    sector: "",
    industry: "ไม่พบในฐานข้อมูล local",
    risk: 72,
    note: "ยังไม่มีในฐานข้อมูล local จึงถือเป็นสินทรัพย์เสี่ยงจนกว่าจะระบุ sector ได้",
    source: "not found",
  };
}

function formatPct(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSectorLine(meta) {
  const parts = [meta.sector, meta.industry].filter(Boolean);
  const indexes = formatIndexTags(meta);
  const base = parts.length ? parts.join(" / ") : "รอข้อมูล sector";
  return indexes ? `${base} / ${indexes}` : base;
}

function formatIndexTags(meta) {
  if (!Array.isArray(meta.indexes) || !meta.indexes.length) return "";
  return meta.indexes.map((key) => INDEX_LABELS[key] || key).join(", ");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function renderLookupHint() {
  const hint = $("assetLookupHint");
  const symbol = normalizeTicker($("symbolInput").value);
  if (!symbol) {
    hint.textContent = "พิมพ์ ticker เพื่อดู sector และกลุ่มอัตโนมัติ";
    hint.className = "lookup-hint";
    return;
  }

  const meta = resolveAsset(symbol);
  const sleeve = SLEEVES[meta.sleeve] || SLEEVES.unknown;
  if (meta.sleeve === "unknown") {
    const apiState = API_ASSET_CACHE.get(symbol)?.status;
    if (apiState === "loading") {
      hint.textContent = `${symbol}: กำลังค้นข้อมูลจาก API`;
      hint.className = "lookup-hint is-loading";
      return;
    }
    if (apiState === "error") {
      hint.textContent = `${symbol}: เรียก API ไม่สำเร็จ`;
      hint.className = "lookup-hint is-unknown";
      return;
    }
    if (apiState === "missing") {
      hint.textContent = `${symbol}: API ยังไม่พบ sector`;
      hint.className = "lookup-hint is-unknown";
      return;
    }
    if (ASSET_API_ENDPOINT) {
      hint.textContent = `${symbol}: ไม่พบใน local กำลังเตรียมค้น API`;
      hint.className = "lookup-hint is-loading";
      scheduleApiLookup(symbol);
      return;
    }
    hint.textContent = `${symbol}: ยังไม่มีใน local และยังไม่ได้ตั้ง API endpoint`;
    hint.className = "lookup-hint is-unknown";
    return;
  }

  const sourceLabel = meta.source?.includes("api") || meta.source === "fmp" ? "API" : "local";
  hint.textContent = `${symbol}: ${formatSectorLine(meta)} -> ${sleeve.label} (${sourceLabel})`;
  hint.className = "lookup-hint is-known";
}

function analyzePortfolio(holdings, profileKey) {
  const profile = PROFILES[profileKey];
  const total = holdings.reduce((sum, item) => sum + item.weight, 0);
  const normalized = holdings.map((item) => ({
    ...item,
    normalizedWeight: total > 0 ? (item.weight / total) * 100 : 0,
  }));

  const sleeves = Object.keys(SLEEVES).reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  normalized.forEach((item) => {
    sleeves[item.sleeve] = (sleeves[item.sleeve] || 0) + item.normalizedWeight;
  });

  const weightedRisk = normalized.reduce((sum, item) => sum + item.normalizedWeight * item.risk, 0) / 100;
  const riskyHoldingWeights = normalized
    .filter((item) => isConcentrationRisk(item))
    .map((item) => item.normalizedWeight);
  const maxRiskyWeight = Math.max(0, ...riskyHoldingWeights);
  const concentrationPenalty = Math.max(0, maxRiskyWeight - 15) * 0.9;
  const unknownPenalty = (sleeves.unknown || 0) * 0.35;
  const gapTotal = Object.entries(profile.targets).reduce((sum, [sleeve, target]) => {
    return sum + Math.abs((sleeves[sleeve] || 0) - target);
  }, 0);
  const cashStabilizer = Math.min(sleeves.cash || 0, 25) * 0.18;
  const riskScore = Math.max(0, Math.min(100, weightedRisk + concentrationPenalty + unknownPenalty - cashStabilizer));
  const fitScore = Math.max(0, Math.min(100, 100 - gapTotal * 1.15 - (sleeves.unknown || 0) * 0.6));

  return {
    profile,
    profileKey,
    total,
    holdings: normalized,
    sleeves,
    riskScore,
    fitScore,
    gapTotal,
    maxRiskyWeight,
  };
}

function isConcentrationRisk(item) {
  return item.sleeve === "growth" || item.sleeve === "unknown" || item.symbol === "VG";
}

function riskLabel(score) {
  if (score < 38) return "ต่ำ";
  if (score < 65) return "กลาง";
  return "สูง";
}

function fitLabel(score) {
  if (score >= 82) return "ใกล้แผน";
  if (score >= 62) return "พอใช้";
  return "ต้องปรับ";
}

function renderSummary(result) {
  $("riskLabel").textContent = riskLabel(result.riskScore);
  $("riskScore").textContent = `คะแนน ${result.riskScore.toFixed(0)} / 100`;
  $("fitLabel").textContent = fitLabel(result.fitScore);
  $("fitScore").textContent = `ความเข้ากัน ${result.fitScore.toFixed(0)} / 100`;
  $("totalUsdValue").textContent = formatMoney(result.total);
  $("totalStatus").textContent = "คำนวณจากมูลค่า USD ที่กรอก";
  $("profileName").textContent = result.profile.label;
}

function renderCurrentMix(result) {
  const rows = SLEEVE_ORDER
    .filter((key) => (result.sleeves[key] || 0) > 0.1)
    .map((key) => {
      const sleeve = SLEEVES[key];
      const current = result.sleeves[key] || 0;
      const amount = result.total * current / 100;
      return `
        <article class="current-mix-card">
          <strong><i style="background:${sleeve.color};"></i>${sleeve.label}<span>${formatPct(current)}</span></strong>
          <p>${formatMoney(amount)} / ${sleeve.description}</p>
        </article>
      `;
    })
    .join("");

  $("currentMixList").innerHTML = rows || "<p>ยังไม่มีสินทรัพย์ในพอร์ต</p>";
  $("currentMixPie").style.background = buildPieGradient(result);
}

function buildPieGradient(result) {
  const segments = [];
  let cursor = 0;
  SLEEVE_ORDER.forEach((key) => {
    const value = result.sleeves[key] || 0;
    if (value <= 0.1) return;
    const start = cursor;
    const end = cursor + value * 3.6;
    segments.push(`${SLEEVES[key].color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`);
    cursor = end;
  });

  if (!segments.length) return "#edf1ef";
  return `conic-gradient(${segments.join(", ")})`;
}

function renderAllocation(result) {
  const rows = SLEEVE_ORDER.map((key) => {
    const sleeve = SLEEVES[key];
    const current = result.sleeves[key] || 0;
    const target = result.profile.targets[key] || 0;
    const gap = current - target;
    const meta = key === "unknown"
      ? `${formatPct(current)}`
      : `${formatPct(current)} / เป้าหมาย ${formatPct(target)} / ส่วนต่าง ${gap >= 0 ? "+" : ""}${formatPct(gap)}`;
    const currentWidth = Math.max(0, Math.min(current, 100));
    const targetLeft = Math.max(0, Math.min(target, 100));

    return `
      <article class="allocation-row">
        <div class="allocation-top">
          <strong>${sleeve.label}</strong>
          <span class="allocation-meta">${meta}</span>
        </div>
        <div class="bar-track" aria-label="${sleeve.label}">
          <span class="bar-current" style="width:${currentWidth}%; background:${sleeve.color};"></span>
          <span class="bar-target" style="left:${targetLeft}%;"></span>
        </div>
      </article>
    `;
  }).join("");

  $("allocationList").innerHTML = rows;
}

function buildRecommendations(result) {
  const items = [];
  const targets = result.profile.targets;
  const sleeves = result.sleeves;
  const capital = result.total;

  SLEEVE_ORDER
    .filter((sleeve) => Object.prototype.hasOwnProperty.call(targets, sleeve))
    .forEach((sleeve) => {
    const target = targets[sleeve];
    const current = sleeves[sleeve] || 0;
    const gap = target - current;
    if (Math.abs(gap) < 3) return;
    const sleeveName = SLEEVES[sleeve].label;
    const money = capital ? ` หรือประมาณ ${formatMoney(Math.abs(gap) * capital / 100)}` : "";
    if (gap > 0) {
      items.push(`เพิ่ม ${sleeveName} อีกประมาณ ${formatPct(gap)}${money} เพื่อเข้าใกล้แผน ${result.profile.label}`);
    } else {
      items.push(overweightMessage(sleeve, sleeveName, Math.abs(gap), money));
    }
  });

  const goldWeight = result.holdings
    .filter((item) => item.symbol === "IAU")
    .reduce((sum, item) => sum + item.normalizedWeight, 0);
  const cashWeight = sleeves.cash || 0;
  const growthWeight = sleeves.growth || 0;
  const topRiskHolding = result.holdings
    .filter((item) => isConcentrationRisk(item))
    .sort((a, b) => b.normalizedWeight - a.normalizedWeight)[0];

  if (goldWeight < 5) items.push("ทองคำต่ำกว่า 5% จึงกันความเสี่ยงสงคราม เงินเฟ้อ และค่าเงินได้น้อยกว่าที่ควรสำหรับพอร์ตกันกระแทก");
  if (cashWeight < Math.min(12, targets.cash - 5)) items.push("เงินพักต่ำมาก ทำให้มีพื้นที่ซื้อตอนตลาดตกน้อยลง");
  if (cashWeight >= targets.cash - 3 && cashWeight <= targets.cash + 6) items.push("SGOV/Cash อยู่ในกรอบที่ดี ทำหน้าที่เป็นเงินพักและกระสุนสำรอง ไม่ใช่ความเสี่ยงรายตัว");
  if (growthWeight > targets.growth + 15) items.push("Growth สูงกว่าเป้าหมายมาก พอร์ตจะไวต่อ Nasdaq และ valuation หุ้น AI");
  if (topRiskHolding && topRiskHolding.normalizedWeight > 18) items.push(`${topRiskHolding.symbol} มีสัดส่วน ${formatPct(topRiskHolding.normalizedWeight)} ซึ่งเริ่มเป็นความเสี่ยงรายตัว`);
  if ((sleeves.unknown || 0) > 0) items.push("มีสินทรัพย์ที่ระบบยังไม่รู้ sector ควรอัปเดตฐานข้อมูล local หรือเรียก fallback API ก่อนใช้คะแนนจริง");

  if (!items.length) {
    items.push("พอร์ตใกล้เคียงแผนที่เลือก จุดสำคัญคือรักษาวินัย DCA และ rebalance เมื่อสัดส่วนเบี่ยงมาก");
  }

  return items;
}

function overweightMessage(sleeve, sleeveName, gap, money) {
  if (sleeve === "cash") {
    return `${sleeveName} สูงกว่าแผนประมาณ ${formatPct(gap)}${money} พอร์ตนิ่งขึ้น แต่โอกาสเติบโตอาจลดลง`;
  }
  if (sleeve === "hedge") {
    return `${sleeveName} สูงกว่าแผนประมาณ ${formatPct(gap)}${money} เกราะหนาขึ้น แต่ผลตอบแทนช่วงตลาดกระทิงอาจช้าลง`;
  }
  if (sleeve === "growth") {
    return `${sleeveName} เกินแผนประมาณ ${formatPct(gap)}${money} พอร์ตจะไวต่อ Nasdaq และ valuation หุ้นเติบโต`;
  }
  if (sleeve === "diversified") {
    return `${sleeveName} สูงกว่าแผนประมาณ ${formatPct(gap)}${money} ควรดูว่ายังช่วยกระจายความเสี่ยงจริงหรือทำให้พอร์ตกระจายเกินจำเป็น`;
  }
  return `${sleeveName} เกินแผนประมาณ ${formatPct(gap)}${money}`;
}

function renderRecommendations(result) {
  $("recommendationList").innerHTML = buildRecommendations(result)
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function renderRebalancePlan(result) {
  const capital = result.total;
  const groupCards = SLEEVE_ORDER
    .map((sleeve) => {
      const target = result.profile.targets[sleeve] || 0;
      const current = result.sleeves[sleeve] || 0;
      const delta = target - current;
      return { sleeve, current, target, delta };
    })
    .filter((item) => Math.abs(item.delta) >= 3)
    .map((item) => {
      const action = item.delta > 0 ? "เพิ่ม" : "ลด";
      const className = item.delta > 0 ? "add" : "reduce";
      const money = capital ? ` / ${formatMoney(Math.abs(item.delta) * capital / 100)}` : "";
      const sleeve = SLEEVES[item.sleeve];
      const parts = rebalanceComponents(result, item.sleeve, item.delta);
      const componentText = parts.length
        ? parts.map((asset) => `<span class="mini-chip">${asset.symbol} ${formatPct(asset.weight)}</span>`).join("")
        : `<span class="mini-chip">${sleeveFallback(item.sleeve, item.delta > 0)}</span>`;

      return `
        <article class="rebalance-card group-card">
          <div>
            <strong>${sleeve.label} <span>${action} ${formatPct(Math.abs(item.delta))}</span></strong>
            <small>ตอนนี้ ${formatPct(item.current)} / เป้าหมาย ${formatPct(item.target)}${money}</small>
            <div class="rebalance-components">${componentText}</div>
          </div>
          <span class="rebalance-change ${className}">${action}</span>
        </article>
      `;
    });

  $("rebalanceList").innerHTML = groupCards.join("") || `
    <article class="rebalance-card">
      <div>
        <strong>ใกล้เป้าหมายแล้ว</strong>
        <small>สัดส่วนตามหมวดหลักอยู่ใกล้แผน ${result.profile.label} จุดสำคัญคือคุม DCA และ rebalance เมื่อหมวดใดเกินกรอบ</small>
      </div>
      <span class="rebalance-change hold">ถือ</span>
    </article>
  `;
}

function rebalanceComponents(result, sleeve, delta) {
  if (delta > 0) return additionComponents(sleeve, delta);
  return reductionComponents(result, sleeve, Math.abs(delta));
}

function additionComponents(sleeve, amount) {
  const candidates = Object.entries(BASE_TARGETS)
    .map(([symbol, baseWeight]) => ({ symbol, baseWeight, meta: ASSET_MAP[symbol] }))
    .filter((item) => item.meta?.sleeve === sleeve);
  const totalBase = candidates.reduce((sum, item) => sum + item.baseWeight, 0);
  if (!totalBase) return [];

  return candidates
    .map((item) => ({
      symbol: item.symbol,
      weight: amount * item.baseWeight / totalBase,
    }))
    .filter((item) => item.weight >= 0.5)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function reductionComponents(result, sleeve, amount) {
  const candidates = result.holdings.filter((item) => item.sleeve === sleeve);
  const totalCurrent = candidates.reduce((sum, item) => sum + item.normalizedWeight, 0);
  if (!totalCurrent) return [];

  return candidates
    .map((item) => ({
      symbol: item.symbol,
      weight: amount * item.normalizedWeight / totalCurrent,
    }))
    .filter((item) => item.weight >= 0.5)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function sleeveFallback(sleeve, isAdding) {
  const examplesBySleeve = {
    growth: "PLTR / MRVL / MU / TSLA",
    diversified: "EWJ",
    hedge: "IAU / OXY / CF / CHKP",
    cash: "SGOV",
  };

  if (!isAdding) return "ทยอยลดตัวที่เกินแผน";
  return examplesBySleeve[sleeve] || "";
}

function buildPortfolioView(result) {
  const sleeves = result.sleeves;
  const targets = result.profile.targets;
  const parts = [];
  const growthGap = (sleeves.growth || 0) - targets.growth;
  const hedgeGap = (sleeves.hedge || 0) - targets.hedge;
  const cashGap = (sleeves.cash || 0) - targets.cash;
  const unknown = sleeves.unknown || 0;

  parts.push(`ถ้าเลือกแผน${result.profile.label} พอร์ตนี้ควรมี Growth ประมาณ ${formatPct(targets.growth)}, Hedge & Defense ${formatPct(targets.hedge)} และ Cash ${formatPct(targets.cash)}.`);

  if (growthGap > 6) {
    parts.push("ตอนนี้พอร์ตเอนไปทางเติบโตมากกว่ากรอบ จึงมีโอกาสโตดีตอนตลาด AI แข็งแรง แต่จะเจ็บง่ายถ้า Nasdaq หรือหุ้นชิปถูกขาย.");
  } else if (growthGap < -6) {
    parts.push("ตอนนี้ Growth ต่ำกว่าแผน พอร์ตจะนิ่งขึ้นแต่แรงขับระยะยาวอาจไม่พอ ถ้ายังเชื่อ AI เป็น megatrend ควรเติมกลุ่มนี้แบบค่อยเป็นค่อยไป.");
  } else {
    parts.push("น้ำหนัก Growth อยู่ใกล้กรอบ จึงยังมีเครื่องยนต์เติบโตโดยไม่เร่งความเสี่ยงเกินไป.");
  }

  if (hedgeGap < -5) {
    parts.push("ชั้นป้องกันยังบางไป โดยเฉพาะทองคำ พลังงาน อาหาร cyber หรือ defense ทำให้รับมือเงินเฟ้อและสงครามได้น้อยกว่าที่ควร.");
  } else if (hedgeGap > 7) {
    parts.push("ชั้น Hedge หนามาก พอร์ตจะทนแรงกระแทกดีขึ้น แต่ผลตอบแทนช่วงตลาดกระทิงอาจตาม Growth ไม่ทัน.");
  }

  if (cashGap < -5) {
    parts.push("Cash/SGOV ต่ำกว่าแผน แปลว่าถ้าตลาดลงแรงจะมีกระสุนซื้อเพิ่มน้อย ควรเพิ่มเงินพักก่อนเพิ่มความเสี่ยงใหม่.");
  } else if (cashGap > 8) {
    parts.push("เงินพักสูงกว่ากรอบ พอร์ตนิ่งขึ้นแต่เสียโอกาสโต หากตลาดไม่แพงเกินไปอาจทยอย DCA เข้ากลุ่มเป้าหมาย.");
  }

  if (unknown > 0) {
    parts.push(`มีสินทรัพย์ที่ยังไม่รู้กลุ่ม ${formatPct(unknown)} จึงควรอัปเดตฐานข้อมูล local หรือใช้ fallback API ก่อนใช้เป็นคำตอบจริง.`);
  }

  return parts.join(" ");
}

function renderPortfolioView(result) {
  $("portfolioView").textContent = buildPortfolioView(result);
}

function renderScenarios(result) {
  const inflation = clampScore(
    symbolWeight(result, ["OXY", "CF", "VG", "IAU"]) * 2.25 +
    (result.sleeves.hedge || 0) * 0.45
  );
  const war = clampScore(
    symbolWeight(result, ["ESLT", "KTOS", "AVAV", "CHKP", "OXY", "VG", "IAU"]) * 2 +
    (result.sleeves.cash || 0) * 0.9
  );
  const selloff = clampScore(
    (result.sleeves.cash || 0) * 2.6 +
    symbolWeight(result, ["IAU", "PG", "CHKP"]) * 1.45
  );
  const aiBoom = clampScore(
    symbolWeight(result, ["PLTR", "MRVL", "MU", "TSLA", "TSEM"]) * 1.9 +
    symbolWeight(result, ["GEV", "ORA"]) * 0.35 +
    (result.sleeves.growth || 0) * 0.25
  );

  const scenarios = [
    {
      title: "เงินเฟ้อกลับมา",
      score: inflation,
      icon: "INF",
      detail: "ดูน้ำหนักพลังงาน ปุ๋ย และทองคำเป็นหลัก",
    },
    {
      title: "สงครามยืดเยื้อ",
      score: war,
      icon: "WAR",
      detail: "ดู defense, cyber, energy และทองคำ",
    },
    {
      title: "ตลาดหุ้นลงแรง",
      score: selloff,
      icon: "DEF",
      detail: "ดู SGOV/cash เพื่อรอโอกาสและลดการขายผิดจังหวะ",
    },
    {
      title: "AI ยังเป็น megatrend",
      score: aiBoom,
      icon: "AI",
      detail: "ดู Growth ที่โยง AI, semiconductor และ infrastructure",
    },
  ];

  const health = portfolioHealthScore(scenarios);
  const lowest = [...scenarios].sort((a, b) => a.score - b.score)[0];
  $("scenarioGrid").innerHTML = `
    <article class="health-card ${scoreClass(health)}">
      <div>
        <span>สุขภาพพอร์ต</span>
        <strong>${health}/100</strong>
        <p>${healthMessage(health, lowest)}</p>
      </div>
      <div class="health-ring" style="--score:${health};">${healthLabel(health)}</div>
    </article>
    ${scenarios.map((item) => `
      <article class="scenario-card ${scoreClass(item.score)}">
        <div class="scenario-top">
          <span class="scenario-icon">${item.icon}</span>
          <div>
            <strong>${item.title}<span class="scenario-score">${item.score}/100</span></strong>
            <p>${scenarioMessage(item)}</p>
          </div>
        </div>
        <div class="scenario-bar"><i style="width:${item.score}%;"></i></div>
        <small>${item.detail}</small>
      </article>
    `).join("")}
  `;
}

function symbolWeight(result, symbols) {
  const set = new Set(symbols);
  return result.holdings
    .filter((item) => set.has(item.symbol))
    .reduce((sum, item) => sum + item.normalizedWeight, 0);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function portfolioHealthScore(scenarios) {
  const average = scenarios.reduce((sum, item) => sum + item.score, 0) / scenarios.length;
  const lowest = Math.min(...scenarios.map((item) => item.score));
  const weakPointPenalty = lowest < 60 ? (60 - lowest) * 0.6 : 0;
  return clampScore(average - weakPointPenalty);
}

function healthLabel(score) {
  if (score >= 85) return "แข็งมาก";
  if (score >= 75) return "พร้อมรับมือ";
  if (score >= 60) return "ใช้ได้";
  if (score >= 40) return "ยังบาง";
  return "อ่อนมาก";
}

function healthMessage(score, lowest) {
  if (lowest.score < 60) {
    return `คะแนนรวมยังมีจุดอ่อน: ${lowest.title} ได้ ${lowest.score}/100 ควรเติมก่อนเพิ่มความเสี่ยงใหม่`;
  }
  if (score >= 85) return "แข็งมาก แต่ต้องระวังว่าพอร์ตอาจ defensive จนเสียโอกาสโตในตลาดกระทิง";
  if (score >= 75) return "รับมือภาพรวมได้ดี มีทั้งเครื่องยนต์เติบโต เกราะป้องกัน และเงินรอโอกาส";
  if (score >= 60) return "พอรับมือได้ แต่ยังควรปรับบางหมวดให้สมดุลกว่าเดิม";
  return "ยังรับมือได้ไม่ครบสภาวะ ควรเพิ่ม hedge หรือ cash ก่อน";
}

function scoreClass(score) {
  if (score >= 85) return "score-excellent";
  if (score >= 75) return "score-strong";
  if (score >= 60) return "score-ok";
  if (score >= 40) return "score-thin";
  return "score-weak";
}

function scenarioMessage(item) {
  if (item.score >= 85) return "แข็งมาก";
  if (item.score >= 75) return "พร้อมรับมือดี";
  if (item.score >= 60) return "พอใช้ แต่ยังเติมได้";
  if (item.score >= 40) return "ยังบาง ควรดูเพิ่ม";
  return "อ่อนมาก";
}

function renderEntryTable() {
  const totalUsd = assetRows.reduce((sum, row) => {
    const amount = Number(row.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);

  $("entryTable").innerHTML = assetRows.map((row) => {
    const symbol = normalizeTicker(row.symbol);
    const meta = resolveAsset(symbol);
    const sleeve = SLEEVES[meta.sleeve] || SLEEVES.unknown;
    const valueUsd = Number(row.amount);
    const weight = totalUsd > 0 ? (valueUsd / totalUsd) * 100 : 0;
    return `
      <tr>
        <td data-label="สินทรัพย์"><span class="symbol-pill">${symbol}</span></td>
        <td data-label="กลุ่ม / Sector">
          <strong class="sleeve-cell">${escapeHtml(sleeve.label)}</strong>
          <span class="asset-sector">${escapeHtml(formatSectorLine(meta))}</span>
        </td>
        <td data-label="มูลค่า USD">${formatMoney(valueUsd)}</td>
        <td data-label="สัดส่วน"><strong>${formatPct(weight)}</strong></td>
        <td data-label=""><button class="small-button" type="button" data-remove-id="${row.id}">ลบ</button></td>
      </tr>
    `;
  }).join("");
}

function addAssetFromForm() {
  const symbol = normalizeTicker($("symbolInput").value);
  const amount = Number(String($("amountInput").value).replace(/[^\d.]/g, ""));
  if (!symbol || !Number.isFinite(amount) || amount <= 0) return;

  assetRows.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    symbol,
    amount,
  });

  $("symbolInput").value = "";
  $("amountInput").value = "";
  $("symbolInput").focus();
  renderLookupHint();
  renderEntryTable();
  runAnalysis();
  lookupAssetFromApi(symbol);
}

function loadSampleAssets() {
  assetRows = SAMPLE_ASSETS.map((row, index) => ({
    id: `sample-${index}`,
    ...row,
  }));
  selectedProfile = "balanced";
  renderEntryTable();
  setProfile("balanced");
}

function runAnalysis() {
  const holdings = getHoldingsFromRows();
  if (!holdings.length) {
    $("riskLabel").textContent = "-";
    $("riskScore").textContent = "-";
    $("fitLabel").textContent = "-";
    $("fitScore").textContent = "-";
    $("totalUsdValue").textContent = "-";
    $("totalStatus").textContent = "ใส่มูลค่าเป็น USD เท่านั้น";
    $("currentMixList").innerHTML = "";
    $("allocationList").innerHTML = "";
    $("rebalanceList").innerHTML = "";
    $("portfolioView").textContent = "กรอกสินทรัพย์และมูลค่า USD ก่อน ระบบจะคำนวณสัดส่วนปัจจุบันให้";
    $("currentMixPie").style.background = "#edf1ef";
    $("scenarioGrid").innerHTML = "";
    $("recommendationList").innerHTML = "<li>ยังไม่มีรายการสินทรัพย์ให้วิเคราะห์</li>";
    return;
  }

  const result = analyzePortfolio(holdings, selectedProfile);
  renderSummary(result);
  renderCurrentMix(result);
  renderAllocation(result);
  renderRebalancePlan(result);
  renderPortfolioView(result);
  renderRecommendations(result);
  renderScenarios(result);
}

function setProfile(profileKey) {
  selectedProfile = profileKey;
  document.querySelectorAll(".profile-tab").forEach((button) => {
    const isActive = button.dataset.profile === profileKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  runAnalysis();
}

document.querySelectorAll(".profile-tab").forEach((button) => {
  button.addEventListener("click", () => setProfile(button.dataset.profile));
});

$("addAssetButton").addEventListener("click", addAssetFromForm);
$("loadSampleButton").addEventListener("click", loadSampleAssets);
$("clearAssetsButton").addEventListener("click", () => {
  assetRows = [];
  renderEntryTable();
  runAnalysis();
});

$("entryTable").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-id]");
  if (!button) return;
  assetRows = assetRows.filter((row) => row.id !== button.dataset.removeId);
  renderEntryTable();
  runAnalysis();
});

["symbolInput", "amountInput"].forEach((id) => {
  $(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") addAssetFromForm();
  });
});

$("symbolInput").addEventListener("input", renderLookupHint);

window.addEventListener("beforeunload", (event) => {
  if (!assetRows.length) return;
  event.preventDefault();
  event.returnValue = UNSAVED_EXIT_WARNING;
  return UNSAVED_EXIT_WARNING;
});

loadSampleAssets();
renderLookupHint();
