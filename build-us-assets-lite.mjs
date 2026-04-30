import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(root, "assets/us-assets-lite.js");
const overridesFile = resolve(root, "assets/asset-overrides.json");
const reviewFile = resolve(root, "assets/asset-review-queue.json");
const coverageFile = resolve(root, "assets/index-coverage-report.json");
const apiKey = process.env.FMP_API_KEY || "";
const maxParts = Number(process.env.FMP_BULK_PARTS || 100);
const minMarketCap = Number(process.env.MIN_MARKET_CAP || 1_000_000_000);
const indexEtfs = {
  SP500: "IVV",
  RUSSELL2000: "IWM",
};

if (!apiKey) {
  console.error("FMP_API_KEY is required. This script will not overwrite the local DB without live source data.");
  process.exit(1);
}

const db = {
  sectors: {
    TECH: "Information Technology",
    COMM: "Communication Services",
    DISC: "Consumer Discretionary",
    STAP: "Consumer Staples",
    HEALTH: "Health Care",
    FIN: "Financials",
    IND: "Industrials",
    ENERGY: "Energy",
    UTIL: "Utilities",
    MAT: "Materials",
    RE: "Real Estate",
    ETF: "ETF",
    CASH: "Cash Equivalent",
    UNKNOWN: "Unknown Sector",
  },
  industries: {
    AI_SOFTWARE: "AI / Data Software",
    SOFTWARE: "Software",
    CLOUD: "Cloud / Enterprise Software",
    SEMIS: "Semiconductors",
    MEMORY: "Memory Semiconductors",
    FOUNDRY: "Semiconductor Foundry",
    HARDWARE: "Hardware / Devices",
    INTERNET: "Internet Platforms",
    AD_TECH: "Advertising Technology",
    ECOM: "E-Commerce",
    MEDIA: "Streaming / Media",
    TELECOM: "Telecommunication Services",
    EV: "Electric Vehicles",
    APPAREL: "Apparel / Footwear",
    AUTO: "Automobiles",
    HOME_IMPROVEMENT: "Home Improvement Retail",
    RESTAURANTS: "Restaurants",
    TRAVEL: "Travel / Booking Platforms",
    FINTECH: "Fintech / Crypto",
    BANKS: "Banks",
    ASSET_MGMT: "Asset Management",
    CAPITAL_MARKETS: "Capital Markets",
    PAYMENTS: "Payments",
    INSURANCE: "Insurance",
    EXCHANGE: "Exchange / Market Data",
    PHARMA: "Pharmaceuticals",
    BIOTECH: "Biotechnology",
    HEALTH_SERVICES: "Health Services",
    MEDTECH: "Medical Technology",
    HOSPITALS: "Hospitals",
    HOUSEHOLD: "Household & Personal Products",
    BEVERAGES: "Beverages",
    PACKAGED_FOOD: "Packaged Food",
    DEF_RETAIL: "Defensive Retail",
    DISCOUNT_RETAIL: "Discount Retail",
    AERO_DEF: "Aerospace & Defense",
    AERO: "Aerospace",
    MACHINERY: "Machinery",
    TRANSPORT: "Transportation / Logistics",
    RAILROAD: "Railroad",
    BUSINESS_SERVICES: "Business Services",
    PAYROLL: "Payroll / HCM Services",
    ELECTRICAL: "Electrical Equipment",
    INDUSTRIAL_AUTO: "Industrial Automation",
    POWER_GRID: "Power Grid / Electrification",
    GEOTHERMAL: "Geothermal / Renewable Power",
    OIL_GAS: "Oil & Gas",
    LNG: "Liquefied Natural Gas",
    OIL_SERVICE: "Oilfield Services",
    FERTILIZER: "Fertilizer / Agricultural Inputs",
    WASTE: "Waste Management / Environmental Services",
    CHEMICALS: "Specialty Chemicals",
    METALS: "Metals & Mining",
    GOLD_MINER: "Gold Mining",
    REG_UTILITY: "Regulated Utility",
    CYBER: "Cybersecurity",
    NETWORKING: "Networking Infrastructure",
    SEMI_EQUIP: "Semiconductor Equipment",
    DATA_ANALYTICS: "Data Analytics",
    REIT: "Real Estate / REIT",
    BROAD_ETF: "Broad Market ETF",
    COUNTRY_ETF: "Country / Regional ETF",
    SECTOR_ETF: "Sector ETF",
    SHORT_TREASURY: "Short-Term Treasury ETF",
    BOND_ETF: "Bond ETF",
    LONG_TREASURY: "Long Treasury ETF",
    GOLD_ETF: "Gold ETF",
    SILVER_ETF: "Silver ETF",
    COMMODITY_ETF: "Commodity ETF",
    BTC_ETF: "Bitcoin ETF",
  },
  assets: {},
};

const rules = [
  ["SHORT_TREASURY", "cash", ["t-bill", "treasury bill", "0-3 month", "short treasury", "money market"]],
  ["GOLD_ETF", "hedge", ["gold trust", "gold shares"]],
  ["COMMODITY_ETF", "hedge", ["commodity", "oil fund", "natural gas fund"]],
  ["BROAD_ETF", "diversified", ["s&p 500", "total market", "dow jones", "russell 2000", "broad market"]],
  ["COUNTRY_ETF", "diversified", ["msci", "emerging markets", "developed markets", "international"]],
  ["SECTOR_ETF", "diversified", ["sector spdr", "sector etf"]],
  ["SEMIS", "growth", ["semiconductor", "chip", "integrated circuit"]],
  ["SEMI_EQUIP", "growth", ["semiconductor equipment", "wafer", "lithography"]],
  ["SOFTWARE", "growth", ["software", "application", "saas"]],
  ["CLOUD", "growth", ["cloud", "database", "data platform"]],
  ["AI_SOFTWARE", "growth", ["artificial intelligence", "ai platform"]],
  ["CYBER", "hedge", ["cyber", "security software"]],
  ["POWER_GRID", "growth", ["electrification", "power grid", "electrical equipment", "energy equipment"]],
  ["GEOTHERMAL", "growth", ["geothermal", "renewable power"]],
  ["AERO_DEF", "hedge", ["aerospace and defense", "defense"]],
  ["OIL_GAS", "hedge", ["oil", "gas", "petroleum", "exploration", "integrated oil"]],
  ["LNG", "hedge", ["lng", "liquefied natural gas"]],
  ["FERTILIZER", "hedge", ["fertilizer", "agricultural inputs"]],
  ["HOUSEHOLD", "hedge", ["household", "personal products"]],
  ["BEVERAGES", "hedge", ["beverage", "soft drink"]],
  ["PACKAGED_FOOD", "hedge", ["packaged food", "tobacco", "food products"]],
  ["HEALTH_SERVICES", "hedge", ["managed health", "health services", "health care providers"]],
  ["PHARMA", "hedge", ["pharmaceutical"]],
  ["BIOTECH", "growth", ["biotechnology"]],
  ["MEDTECH", "growth", ["medical devices", "life sciences tools"]],
  ["REG_UTILITY", "hedge", ["regulated electric", "electric utilities", "utilities"]],
  ["WASTE", "hedge", ["waste", "environmental services"]],
  ["BANKS", "diversified", ["bank", "banks"]],
  ["INSURANCE", "diversified", ["insurance"]],
  ["ASSET_MGMT", "diversified", ["asset management", "capital markets"]],
  ["PAYMENTS", "diversified", ["payment", "transaction processing"]],
  ["MACHINERY", "diversified", ["machinery", "construction equipment"]],
  ["RAILROAD", "diversified", ["railroad"]],
  ["TRANSPORT", "diversified", ["transport", "logistics", "air freight"]],
  ["REIT", "diversified", ["reit", "real estate"]],
];

const sectorMap = new Map([
  ["technology", "TECH"],
  ["information technology", "TECH"],
  ["communication services", "COMM"],
  ["consumer discretionary", "DISC"],
  ["consumer cyclical", "DISC"],
  ["consumer staples", "STAP"],
  ["consumer defensive", "STAP"],
  ["health care", "HEALTH"],
  ["healthcare", "HEALTH"],
  ["financial services", "FIN"],
  ["financials", "FIN"],
  ["industrials", "IND"],
  ["energy", "ENERGY"],
  ["utilities", "UTIL"],
  ["basic materials", "MAT"],
  ["materials", "MAT"],
  ["real estate", "RE"],
]);

const overrides = await readOverrides();
const indexMembership = apiKey ? await loadIndexMembership() : new Map();
const profiles = apiKey ? await loadFmpProfiles() : [];
const coveredIndexSymbols = new Set();
const review = [];

for (const profile of profiles) {
  if (!isUsListed(profile)) continue;

  const symbol = normalizeSymbol(profile.symbol || "");
  if (!symbol) continue;
  const indexes = indexMembership.get(symbol) || [];
  const isIndexMember = indexes.length > 0;
  if (!isIndexMember && !profile.isEtf && Number(profile.mktCap || profile.marketCap || 0) < minMarketCap) continue;

  const mapped = mapProfile(profile);
  mapped.indexes = indexes;
  if (isIndexMember) coveredIndexSymbols.add(symbol);
  if (mapped.confidence < 65) {
    review.push({
      symbol,
      name: mapped.name,
      sector: profile.sector || "",
      industry: profile.industry || "",
      suggestedSleeve: mapped.sleeve,
      confidence: mapped.confidence,
    });
  }

  db.assets[symbol] = toAssetRow(mapped);
}

for (const [symbol, item] of Object.entries(overrides)) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const indexes = item.indexes || indexMembership.get(normalizedSymbol) || [];
  db.assets[normalizedSymbol] = compactAssetRow({
    name: item.name || symbol,
    sectorCode: item.sectorCode || "TECH",
    industryCode: item.industryCode || "SOFTWARE",
    sleeve: item.sleeve || "growth",
    risk: Number(item.risk) || 60,
    assetType: item.assetType,
    indexes,
  });
  if (indexes.length) coveredIndexSymbols.add(normalizedSymbol);
}

db.assets = Object.fromEntries(Object.entries(db.assets).sort(([a], [b]) => a.localeCompare(b)));

await writeFile(outFile, `window.DADDY_ASSET_DB = ${JSON.stringify(db, null, 2)};\n`, "utf8");
await writeFile(reviewFile, `${JSON.stringify(review, null, 2)}\n`, "utf8");
await writeFile(coverageFile, `${JSON.stringify(buildCoverageReport(), null, 2)}\n`, "utf8");

console.log(`Wrote ${Object.keys(db.assets).length} assets to ${outFile}`);
console.log(`Wrote ${review.length} review candidates to ${reviewFile}`);
console.log(`Wrote index coverage report to ${coverageFile}`);

async function loadIndexMembership() {
  const membership = new Map();
  for (const [indexName, etfSymbol] of Object.entries(indexEtfs)) {
    const holdings = await fetchEtfHoldings(etfSymbol);
    holdings.forEach((holding) => {
      const symbol = normalizeSymbol(holding.symbol || holding.asset || holding.holdingSymbol || holding.ticker || "");
      if (!symbol || symbol === "N/A" || symbol === "CASH") return;
      const indexes = membership.get(symbol) || [];
      if (!indexes.includes(indexName)) indexes.push(indexName);
      membership.set(symbol, indexes);
    });
  }
  return membership;
}

async function fetchEtfHoldings(etfSymbol) {
  const url = new URL("https://financialmodelingprep.com/stable/etf/holdings");
  url.searchParams.set("symbol", etfSymbol);
  url.searchParams.set("apikey", apiKey);
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function buildCoverageReport() {
  return Object.fromEntries(Object.keys(indexEtfs).map((indexName) => {
    const total = [...indexMembership.values()].filter((indexes) => indexes.includes(indexName)).length;
    const covered = [...coveredIndexSymbols].filter((symbol) => {
      return (indexMembership.get(symbol) || []).includes(indexName);
    }).length;
    const missing = [...indexMembership.entries()]
      .filter(([, indexes]) => indexes.includes(indexName))
      .map(([symbol]) => symbol)
      .filter((symbol) => !coveredIndexSymbols.has(symbol));
    return [indexName, { proxy: indexEtfs[indexName], total, covered, missing }];
  }));
}

async function loadFmpProfiles() {
  const all = [];
  for (let part = 0; part < maxParts; part += 1) {
    const url = new URL("https://financialmodelingprep.com/stable/profile-bulk");
    url.searchParams.set("part", String(part));
    url.searchParams.set("apikey", apiKey);
    const response = await fetch(url);
    if (!response.ok) break;
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
  }
  return all;
}

function isUsListed(profile) {
  const exchange = String(profile.exchangeShortName || profile.exchange || "").toUpperCase();
  return ["NASDAQ", "NYSE", "AMEX"].includes(exchange);
}

function mapProfile(profile) {
  const name = profile.companyName || profile.name || profile.symbol;
  const sectorCode = sectorCodeFor(profile.sector, profile.isEtf);
  const text = `${profile.companyName || ""} ${profile.sector || ""} ${profile.industry || ""}`.toLowerCase();
  const rule = rules.find(([, , keywords]) => keywords.some((keyword) => text.includes(keyword)));
  const industryCode = rule?.[0] || rawIndustry(profile.industry);
  const sleeve = rule?.[1] || sleeveForSector(sectorCode, profile.isEtf);
  const confidence = rule ? 82 : sectorCode === "UNKNOWN" ? 35 : sectorCode === "TECH" || sectorCode === "DISC" ? 68 : 58;
  return {
    name,
    sectorCode,
    industryCode,
    sleeve,
    risk: estimateRisk(sleeve, Number(profile.beta)),
    assetType: profile.isEtf ? "ETF" : undefined,
    confidence,
  };
}

function sectorCodeFor(sector, isEtf) {
  if (isEtf) return "ETF";
  return sectorMap.get(String(sector || "").toLowerCase()) || "UNKNOWN";
}

function sleeveForSector(sectorCode, isEtf) {
  if (isEtf) return "diversified";
  if (sectorCode === "UNKNOWN") return "unknown";
  if (["STAP", "UTIL", "ENERGY"].includes(sectorCode)) return "hedge";
  if (["TECH", "COMM"].includes(sectorCode)) return "growth";
  return "diversified";
}

function rawIndustry(industry) {
  return String(industry || "Business Services").replace(/[^A-Za-z0-9 /&.-]/g, "").slice(0, 48);
}

function estimateRisk(sleeve, beta) {
  const base = { cash: 10, hedge: 44, diversified: 54, growth: 72, unknown: 60 }[sleeve] || 60;
  if (!Number.isFinite(beta) || beta <= 0) return base;
  return Math.max(10, Math.min(94, Math.round(base + (beta - 1) * 12)));
}

function toAssetRow(mapped) {
  return compactAssetRow(mapped);
}

function compactAssetRow(mapped) {
  const row = [
    mapped.name,
    mapped.sectorCode,
    mapped.industryCode,
    mapped.sleeve,
    mapped.risk,
  ];
  if (mapped.assetType || mapped.indexes?.length) row.push(mapped.assetType || "Stock");
  if (mapped.indexes?.length) row.push(mapped.indexes);
  return row;
}

function normalizeSymbol(symbol) {
  return String(symbol).trim().toUpperCase().replace("-", ".").replace(/[^A-Z0-9.]/g, "");
}

async function readOverrides() {
  try {
    return JSON.parse(await readFile(overridesFile, "utf8"));
  } catch {
    return {};
  }
}
