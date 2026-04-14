const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
app.use(cors());
app.use(express.json());

const SERP_API_KEY = process.env.SERP_API_KEY || "";

// In-memory store: { [marketId]: { scans: [ { timestamp, results: [{keyword, position, url, serp}] } ] } }
const store = {};

// ── MARKETS CONFIG ──
const MARKETS = [
  { id: "fr", label: "🇫🇷 France", google_domain: "google.fr", gl: "fr", hl: "fr", feedUrl: "https://www.sportytrader.com/pronostic.xml", targetDomain: "sportytrader.com" },
  { id: "de", label: "🇩🇪 Deutschland", google_domain: "google.de", gl: "de", hl: "de", feedUrl: "https://www.sportytrader.de/prognose-tipps.xml", targetDomain: "sportytrader.de" },
  { id: "it", label: "🇮🇹 Italia", google_domain: "google.it", gl: "it", hl: "it", feedUrl: "https://www.sportytrader.it/pronostici.xml", targetDomain: "sportytrader.it" },
  { id: "pt", label: "🇵🇹 Portugal", google_domain: "google.pt", gl: "pt", hl: "pt", feedUrl: "https://www.sportytrader.pt/prognosticos.xml", targetDomain: "sportytrader.pt" },
  { id: "br", label: "🇧🇷 Brasil", google_domain: "google.com.br", gl: "br", hl: "pt", feedUrl: "https://www.sportytrader.com/pt-br/palpites.xml", targetDomain: "sportytrader.com" },
  { id: "en", label: "🇬🇧 English", google_domain: "google.co.uk", gl: "gb", hl: "en", feedUrl: "https://www.sportytrader.com/en/predictions.xml", targetDomain: "sportytrader.com" },
  { id: "nl", label: "🇳🇱 Nederland", google_domain: "google.nl", gl: "nl", hl: "nl", feedUrl: "https://www.sportytrader.nl/voorspellingen-tips.xml", targetDomain: "sportytrader.nl" },
  { id: "mx", label: "🇲🇽 México", google_domain: "google.com.mx", gl: "mx", hl: "es", feedUrl: "https://www.sportytrader.com/es/pronosticos.xml", targetDomain: "sportytrader.com" },
  { id: "es", label: "🇪🇸 España", google_domain: "google.es", gl: "es", hl: "es", feedUrl: "https://www.sportytrader.es/pronosticos.xml", targetDomain: "sportytrader.es" },
];

// Keyword transform: clean title before sending to SerpAPI
function buildSearchQuery(title, marketId) {
  let q = title;
  // DE: remove "Wett" word
  if (marketId === "de") {
    q = q.replace(/\bWett\b/gi, "").replace(/\s+/g, " ").trim();
  }
  // All markets: remove dashes (with or without spaces), en-dash, em-dash
  q = q.replace(/ - /g, " ").replace(/ – /g, " ").replace(/ — /g, " ");
  q = q.replace(/-/g, " ").replace(/–/g, " ").replace(/—/g, " ");
  // Collapse multiple spaces
  q = q.replace(/\s+/g, " ").trim();
  // Lowercase
  q = q.toLowerCase();
  return q;
}

// ── UTILS ──
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || "";
    const matchDate = (block.match(/<matchDate>(.*?)<\/matchDate>/) || [])[1] || "";
    const ligue = (block.match(/<ligue>(.*?)<\/ligue>/) || [])[1] || "";
    if (title) items.push({ title: title.trim(), link: link.trim(), matchDate: matchDate.trim(), ligue: ligue.trim() });
  }
  return items;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── ROUTES ──

// GET /markets
app.get("/markets", (req, res) => {
  res.json(MARKETS.map((m) => ({ id: m.id, label: m.label, feedUrl: m.feedUrl })));
});

// POST /fetch-rss  { marketId, xmlContent? }
// Returns parsed items from RSS (either fetched or from provided XML)
app.post("/fetch-rss", async (req, res) => {
  try {
  const { marketId, xmlContent } = req.body;
  console.log(`[RSS] Request for market: ${marketId}`);
  const market = MARKETS.find((m) => m.id === marketId);
  if (!market) return res.status(400).json({ error: "Marché inconnu" });

  let xml = xmlContent || "";

  if (!xml) {
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(market.feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      xml = await resp.text();
    } catch (e) {
      return res.status(500).json({ error: `Impossible de récupérer le feed : ${e.message}. Collez le XML manuellement.` });
    }
  }

  try {
    const items = parseRSS(xml);
    const today = todayStr();
    const filtered = items.filter((i) => i.matchDate && i.matchDate.startsWith(today));
    console.log(`[RSS] ${marketId}: ${items.length} items, ${filtered.length} today`);
    res.json({ total: items.length, today: filtered.length, items: filtered, allItems: items });
  } catch (e) {
    console.error(`[RSS] Parse error:`, e.message);
    res.status(500).json({ error: `Erreur parsing XML : ${e.message}` });
  }
  } catch (e) {
    console.error(`[RSS] Unhandled error:`, e.message);
    res.status(500).json({ error: `Erreur serveur : ${e.message}` });
  }
});

// POST /scan  { marketId, keywords: [{title, matchDate, ligue, link}] }
app.post("/scan", async (req, res) => {
  if (!SERP_API_KEY) return res.status(500).json({ error: "SERP_API_KEY non configurée" });

  const { marketId, keywords } = req.body;
  const market = MARKETS.find((m) => m.id === marketId);
  if (!market || !keywords || !keywords.length) return res.status(400).json({ error: "Paramètres invalides" });

  const results = [];
  const timestamp = new Date().toISOString();

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    try {
      const params = new URLSearchParams({
        api_key: SERP_API_KEY,
        engine: "google",
        q: buildSearchQuery(kw.title, marketId),
        google_domain: market.google_domain,
        gl: market.gl,
        hl: market.hl,
        num: "100",
      });

      const resp = await fetch(`https://serpapi.com/search.json?${params}`);
      const data = await resp.json();

      let position = null;
      let foundUrl = null;
      const organicResults = data.organic_results || [];
      const answerBox = data.answer_box || null;

      // Priority 1: organic results (source of truth for position)
      for (let j = 0; j < organicResults.length; j++) {
        const r = organicResults[j];
        const link = (r.link || "").toLowerCase();
        if (link.includes(market.targetDomain)) {
          position = r.position || j + 1;
          foundUrl = r.link;
          break;
        }
      }

      // Priority 2: answer_box only if NOT already found in organics
      const answerBoxIsOurs = answerBox && answerBox.link &&
        answerBox.link.toLowerCase().includes(market.targetDomain);
      if (!position && answerBoxIsOurs) {
        position = 1;
        foundUrl = answerBox.link;
      }

      // Detect true featured snippet (position 0): answer_box from a DIFFERENT domain
      const isTrueFeaturedSnippet = answerBox && answerBox.link &&
        !answerBox.link.toLowerCase().includes(market.targetDomain) &&
        answerBox.type !== "news_result" &&
        answerBox.type !== "top_stories";

      // Store top 10 organic + special features for SERP view
      const serpSnapshot = {
        organic: organicResults.slice(0, 10).map((r) => ({
          position: r.position,
          title: r.title,
          link: r.link,
          displayed_link: r.displayed_link,
          snippet: r.snippet,
          isTarget: (r.link || "").toLowerCase().includes(market.targetDomain),
        })),
        newsBox: (data.news_results || []).slice(0, 5).map((r) => ({
          title: r.title,
          link: r.link,
          source: r.source,
          date: r.date,
        })),
        featuredSnippet: isTrueFeaturedSnippet ? {
          title: answerBox.title,
          snippet: answerBox.snippet || answerBox.answer,
          link: answerBox.link,
        } : null,
        answerBoxIsOurs: !!answerBoxIsOurs,
        hasFeaturedPosition: !!answerBoxIsOurs,
        totalOrganic: organicResults.length,
        searchUrl: `https://www.${market.google_domain}/search?q=${encodeURIComponent(buildSearchQuery(kw.title, marketId))}&gl=${market.gl}&hl=${market.hl}`,
      };

      // Check if our domain appears in news box (SerpAPI uses news_results OR top_stories)
      const newsResults = [...(data.news_results || []), ...(data.top_stories || [])];
      let inNewsBox = false;
      let newsPosition = null;
      for (let n = 0; n < newsResults.length; n++) {
        const nlink = (newsResults[n].link || "").toLowerCase();
        if (nlink.includes(market.targetDomain)) {
          inNewsBox = true;
          newsPosition = n + 1;
          break;
        }
      }

      results.push({
        keyword: kw.title,
        searchQuery: buildSearchQuery(kw.title, marketId),
        matchDate: kw.matchDate,
        ligue: kw.ligue,
        link: kw.link,
        position,
        foundUrl,
        inNewsBox,
        newsPosition,
        isFeatured: !!answerBoxIsOurs,
        totalResults: organicResults.length,
        serp: serpSnapshot,
      });
    } catch (e) {
      results.push({ keyword: kw.title, matchDate: kw.matchDate, ligue: kw.ligue, link: kw.link, position: null, error: e.message });
    }

    if (i < keywords.length - 1) await sleep(800);
  }

  // Store scan
  if (!store[marketId]) store[marketId] = { scans: [] };
  store[marketId].scans.push({ timestamp, results });
  // Keep max 50 scans per market
  if (store[marketId].scans.length > 50) store[marketId].scans.shift();

  res.json({ timestamp, results, marketId });
});

// GET /history/:marketId
app.get("/history/:marketId", (req, res) => {
  const { marketId } = req.params;
  res.json(store[marketId] || { scans: [] });
});

// DELETE /history/:marketId
app.delete("/history/:marketId", (req, res) => {
  delete store[marketId];
  res.json({ ok: true });
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SERP Tracker backend running on port ${PORT}`));
