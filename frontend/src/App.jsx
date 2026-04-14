import React, { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── API BASE URL ──
// In prod (Render), set VITE_API_URL env var to your backend URL
const API = import.meta.env.VITE_API_URL || "/api";

// ── HELPERS ──
const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const posColor = (p) => {
  if (!p) return "#6b6b8a";
  if (p <= 3) return "#00e096";
  if (p <= 10) return "#00e5ff";
  if (p <= 20) return "#ffaa00";
  return "#ff3d71";
};

const posBg = (p) => {
  if (!p) return "rgba(107,107,138,0.1)";
  if (p <= 3) return "rgba(0,224,150,0.12)";
  if (p <= 10) return "rgba(0,229,255,0.10)";
  if (p <= 20) return "rgba(255,170,0,0.10)";
  return "rgba(255,61,113,0.10)";
};

function Delta({ scans, keyword }) {
  if (scans.length < 2) return null;
  const last = scans[scans.length - 1].results.find((r) => r.keyword === keyword);
  const prev = scans[scans.length - 2].results.find((r) => r.keyword === keyword);
  if (!last?.position || !prev?.position) return null;
  const diff = prev.position - last.position;
  if (diff === 0) return <span style={{ color: "#6b6b8a", fontFamily: "var(--font-mono)", fontSize: 11 }}>—</span>;
  return (
    <span style={{ color: diff > 0 ? "#00e096" : "#ff3d71", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
      {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
    </span>
  );
}

// ── MODAL HISTORY CHART ──
function HistoryModal({ keyword, scans, onClose }) {
  const data = scans
    .map((s) => {
      const r = s.results.find((x) => x.keyword === keyword);
      return { time: fmtTime(s.timestamp), position: r?.position || null };
    })
    .filter((d) => d.position !== null);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
          padding: 32, width: "min(700px, 95vw)", maxHeight: "80vh", overflow: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: 2, marginBottom: 6 }}>HISTORIQUE POSITIONS</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{keyword}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 24, lineHeight: 1 }}>×</button>
        </div>

        {data.length < 2 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Pas assez de scans pour afficher l'évolution.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
              <YAxis reversed stroke="var(--text-muted)" tick={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }}
                formatter={(v) => [`#${v}`, "Position"]}
              />
              <Line type="monotone" dataKey="position" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          {scans.map((s, i) => {
            const r = s.results.find((x) => x.keyword === keyword);
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", background: "var(--surface2)", borderRadius: 8,
                border: "1px solid var(--border)",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{fmt(s.timestamp)}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: posColor(r?.position) }}>
                  {r?.position ? `#${r.position}` : (r?.inNewsBox ? "—" : ">T10")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── XML PASTE MODAL ──
function XmlModal({ market, onClose, onImport }) {
  const [xml, setXml] = useState("");
  const [filterToday, setFilterToday] = useState(true);

  const handleImport = async () => {
    try {
      const resp = await fetch(`${API}/fetch-rss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, xmlContent: xml }),
      });
      const data = await resp.json();
      if (data.error) { alert(data.error); return; }
      onImport(data.allItems || data.items || [], market.id);
      onClose();
    } catch (e) { alert("Erreur : " + e.message); }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        padding: 32, width: "min(640px, 95vw)",
      }}>
        <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: 2, marginBottom: 8 }}>IMPORT XML MANUEL</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{market.label}</div>
        <textarea
          value={xml}
          onChange={(e) => setXml(e.target.value)}
          placeholder={"Collez le contenu XML du feed RSS ici…\n\n<item>\n  <title>Pronostic PSG - Marseille</title>\n  <matchDate>2026-04-13 20:45:00</matchDate>\n  <ligue>France - Ligue 1</ligue>\n  …\n</item>"}
          style={{
            width: "100%", height: 200, background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text)", padding: 12, fontSize: 12, resize: "vertical",
          }}
        />
        <div style={{ marginTop: 12, marginBottom: 20, fontSize: 12, color: "var(--text-muted)" }}>
          Tous les matchs seront importés — utilisez les filtres Aujourd'hui / Demain sur le dashboard.
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", background: "none", border: "1px solid var(--border)",
            color: "var(--text-muted)", borderRadius: 8, fontSize: 13,
          }}>Annuler</button>
          <button onClick={handleImport} disabled={!xml.trim()} style={{
            padding: "10px 20px", background: xml.trim() ? "var(--accent)" : "var(--border)",
            border: "none", color: xml.trim() ? "#000" : "var(--text-muted)", borderRadius: 8,
            fontSize: 13, fontWeight: 700,
          }}>Importer</button>
        </div>
      </div>
    </div>
  );
}


// ── SERP VIEW MODAL ──
function SerpModal({ result, onClose }) {
  if (!result) return null;
  const serp = result.serp || {};
  const organic = serp.organic || [];
  const newsBox = serp.newsBox || [];
  const featured = serp.featuredSnippet;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        padding: 28, width: "min(780px, 96vw)", maxHeight: "85vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: 2, marginBottom: 6 }}>VUE SERP</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{result.keyword}</div>
            <a href={serp.searchUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              ↗ Voir sur Google
            </a>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 24 }}>×</button>
        </div>

        {/* True Featured Snippet (autre domaine) */}
        {featured && (
          <div style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--yellow)", fontFamily: "var(--font-mono)", letterSpacing: 1, marginBottom: 6 }}>⚠️ POSITION 0 — CONCURRENT EN FEATURED SNIPPET</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{featured.title}</div>
            {featured.snippet && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{featured.snippet}</div>}
            {featured.link && <a href={featured.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{featured.link}</a>}
          </div>
        )}

        {/* Notre site en answer box enrichie */}
        {serp.answerBoxIsOurs && (
          <div style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: 1, marginBottom: 4 }}>✅ RÉSULTAT ENRICHI #1 — SPORTYTRADER</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Notre page est affichée en position #1 avec extrait enrichi (pas un vrai featured snippet concurrent).</div>
          </div>
        )}

        {/* News Box */}
        {newsBox.length > 0 && (
          <div style={{ background: "rgba(162,89,255,0.08)", border: "1px solid rgba(162,89,255,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--accent3)", fontFamily: "var(--font-mono)", letterSpacing: 1, marginBottom: 10 }}>📰 NEWS BOX ({newsBox.length} articles)</div>
            {newsBox.map((n, i) => (
              <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < newsBox.length - 1 ? "1px solid rgba(162,89,255,0.15)" : "none" }}>
                <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--text)", textDecoration: "none", fontWeight: 600 }}>{n.title}</a>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{n.source} · {n.date}</div>
              </div>
            ))}
          </div>
        )}

        {/* Organic results */}
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: 1, marginBottom: 10 }}>
          RÉSULTATS ORGANIQUES ({organic.length} affichés)
        </div>
        {organic.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20, fontSize: 13 }}>
            Aucune donnée SERP — relancez un scan pour voir les résultats.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {organic.map((r, i) => (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 8,
                background: r.isTarget ? "rgba(0,229,255,0.08)" : "var(--surface2)",
                border: `1px solid ${r.isTarget ? "var(--accent)" : "var(--border)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, minWidth: 28,
                    color: r.isTarget ? "var(--accent)" : "var(--text-muted)",
                  }}>#{r.position}</span>
                  {r.isTarget && <span style={{ fontSize: 10, background: "var(--accent)", color: "#000", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>VOUS</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.title}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 3, paddingLeft: 38 }}>{r.displayed_link}</div>
                {r.snippet && <div style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 38, lineHeight: 1.4 }}>{r.snippet}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function App() {
  const [markets, setMarkets] = useState([]);
  const [activeMarket, setActiveMarket] = useState(null);
  const [keywords, setKeywords] = useState({}); // { marketId: [{title, matchDate, ligue, link}] }
  const [history, setHistory] = useState({}); // { marketId: { scans: [] } }
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [historyModal, setHistoryModal] = useState(null);
  const [xmlModal, setXmlModal] = useState(null);
  const [tab, setTab] = useState("dashboard"); // dashboard | history
  const [serpModal, setSerpModal] = useState(null);
  const [dayFilter, setDayFilter] = useState("today"); // today | tomorrow
  const [selectedKws, setSelectedKws] = useState({}); // { marketId: Set of kw.title }
  const stopScanRef = useRef(false);

  // Load markets
  useEffect(() => {
    fetch(`${API}/markets`)
      .then((r) => r.json())
      .then((data) => {
        setMarkets(data);
        if (data.length) setActiveMarket(data[0].id);
      })
      .catch(() => {});
  }, []);

  // Keep backend alive - ping every 8 minutes to prevent Render spin-down
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API}/health`).catch(() => {});
    }, 8 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load history for active market
  const loadHistory = useCallback(async (marketId) => {
    if (!marketId) return;
    try {
      const r = await fetch(`${API}/history/${marketId}`);
      const data = await r.json();
      setHistory((h) => ({ ...h, [marketId]: data }));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (activeMarket) loadHistory(activeMarket);
  }, [activeMarket, loadHistory]);

  // Fetch RSS via backend
  const fetchRSS = async (marketId) => {
    try {
      const resp = await fetch(`${API}/fetch-rss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId }),
      });
      const data = await resp.json();
      if (data.error) {
        setXmlModal(markets.find((m) => m.id === marketId));
        return;
      }
      setKeywords((k) => ({ ...k, [marketId]: data.allItems }));
    } catch (e) {
      setXmlModal(markets.find((m) => m.id === marketId));
    }
  };

  // Import from XML modal
  const handleXmlImport = (items, marketId) => {
    setKeywords((k) => ({ ...k, [marketId]: items })); // items already = allItems from XmlModal
  };

  // Scan
  const handleScan = async () => {
    if (!activeMarket) return;
    const sel = selectedKws[activeMarket];
    const kwsToScan = filteredKws.filter((k) => sel && sel.has(k.title));
    if (!kwsToScan.length) { alert("Sélectionnez au moins un mot-clé à scanner."); return; }

    stopScanRef.current = false;
    setScanning(true);
    setScanProgress({ current: 0, total: kwsToScan.length });

    const scanResults = [];
    for (let i = 0; i < kwsToScan.length; i++) {
      if (stopScanRef.current) break;
      setScanProgress({ current: i + 1, total: kwsToScan.length });
      try {
        const resp = await fetch(`${API}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId: activeMarket, keywords: [kwsToScan[i]] }),
        });
        const data = await resp.json();
        if (data.results) scanResults.push(...data.results);
      } catch (e) {}
    }

    setScanning(false);
    stopScanRef.current = false;
    await loadHistory(activeMarket);
  };

  const handleStop = () => {
    stopScanRef.current = true;
  };

  const toggleSelect = (marketId, title) => {
    setSelectedKws((prev) => {
      const set = new Set(prev[marketId] || []);
      set.has(title) ? set.delete(title) : set.add(title);
      return { ...prev, [marketId]: set };
    });
  };

  const selectAll = (marketId, kws) => {
    setSelectedKws((prev) => {
      const current = prev[marketId] || new Set();
      const allSelected = kws.every((k) => current.has(k.title));
      return { ...prev, [marketId]: allSelected ? new Set() : new Set(kws.map((k) => k.title)) };
    });
  };

  // ── RENDER ──
  const mkt = markets.find((m) => m.id === activeMarket);
  const kws = keywords[activeMarket] || [];
  const hist = history[activeMarket] || { scans: [] };
  const lastScan = hist.scans[hist.scans.length - 1];

  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const kwsByDay = kws.filter((k) => {
    if (dayFilter === "today") return k.matchDate && k.matchDate.startsWith(todayStr);
    if (dayFilter === "tomorrow") return k.matchDate && k.matchDate.startsWith(tomorrowStr);
    return true;
  });
  const filteredKws = kwsByDay;

  const found = lastScan ? lastScan.results.filter((r) => r.position).length : 0;
  const notFound = lastScan ? lastScan.results.filter((r) => !r.position).length : 0;
  const avgPos = lastScan && found
    ? Math.round(lastScan.results.filter((r) => r.position).reduce((a, b) => a + b.position, 0) / found)
    : null;
  const top3 = lastScan ? lastScan.results.filter((r) => r.position <= 3).length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", height: 60,
        background: "var(--surface)", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
            <span style={{ color: "var(--accent)" }}>SERP</span>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <span style={{ color: "var(--text)" }}>TRACKER</span>
          </div>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            SportyTrader · {new Date().toLocaleDateString("fr-FR")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["dashboard", "history"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 16px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600,
              background: tab === t ? "var(--accent)" : "var(--surface2)",
              color: tab === t ? "#000" : "var(--text-muted)",
            }}>{t === "dashboard" ? "Dashboard" : "Historique"}</button>
          ))}
        </div>
      </header>

      <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)",
          overflowY: "auto", padding: "16px 0", flexShrink: 0,
        }}>
          <div style={{ padding: "0 16px 12px", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: 2 }}>
            MARCHÉS
          </div>
          {markets.map((m) => {
            const mHist = history[m.id] || { scans: [] };
            const mKws = keywords[m.id] || [];
            const isActive = m.id === activeMarket;
            return (
              <button key={m.id} onClick={() => setActiveMarket(m.id)} style={{
                width: "100%", padding: "10px 16px", background: isActive ? "rgba(0,229,255,0.08)" : "none",
                border: "none", borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                color: isActive ? "var(--text)" : "var(--text-muted)", textAlign: "left", fontSize: 13,
                display: "flex", flexDirection: "column", gap: 2,
              }}>
                <span>{m.label}</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                  {mKws.length > 0 ? `${mKws.length} mots-clés` : "—"}
                  {mHist.scans.length > 0 ? ` · ${mHist.scans.length} scans` : ""}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {!mkt ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
              Chargement…
            </div>
          ) : tab === "history" ? (
            <HistoryTab hist={hist} />
          ) : (
            <>
              {/* Market header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800 }}>{mkt.label}</h1>
                  {lastScan && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                      Dernier scan : {fmt(lastScan.timestamp)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => fetchRSS(activeMarket)} style={{
                    padding: "10px 18px", background: "var(--surface2)", border: "1px solid var(--border)",
                    color: "var(--text)", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  }}>📡 Feed RSS</button>
                  <button onClick={() => setXmlModal(mkt)} style={{
                    padding: "10px 18px", background: "var(--surface2)", border: "1px solid var(--border)",
                    color: "var(--text)", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  }}>📋 XML Manuel</button>
                  {scanning ? (
                    <button onClick={handleStop} style={{
                      padding: "10px 22px", background: "var(--red)", border: "none",
                      color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    }}>⏹ Stop ({scanProgress.current}/{scanProgress.total})</button>
                  ) : (
                    <button onClick={handleScan} disabled={!filteredKws.length} style={{
                      padding: "10px 22px", background: "var(--accent)", border: "none",
                      color: "#000", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      opacity: !filteredKws.length ? 0.4 : 1,
                    }}>
                      🚀 Scanner ({(selectedKws[activeMarket]?.size) || 0})
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              {lastScan && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Mots-clés scannés", value: lastScan.results.length, color: "var(--text)" },
                    { label: "Positionnés", value: found, color: "var(--green)" },
                    { label: "Top 3", value: top3, color: "var(--accent)" },
                    { label: "Position moy.", value: avgPos ? `#${avgPos}` : "—", color: "var(--yellow)" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                      padding: "16px 20px",
                    }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: 1, marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Day filter */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[["today", "Aujourd'hui"], ["tomorrow", "Demain"]].map(([val, label]) => (
                  <button key={val} onClick={() => setDayFilter(val)} style={{
                    padding: "6px 16px", borderRadius: 20,
                    border: `1px solid ${dayFilter === val ? "var(--accent)" : "var(--border)"}`,
                    background: dayFilter === val ? "rgba(0,229,255,0.1)" : "none",
                    color: dayFilter === val ? "var(--accent)" : "var(--text-muted)", fontSize: 12, fontWeight: 600,
                  }}>{label}</button>
                ))}
              </div>



              {/* Keywords table */}
              {kws.length === 0 ? (
                <div style={{
                  background: "var(--surface)", border: "2px dashed var(--border)", borderRadius: 12,
                  padding: 60, textAlign: "center", color: "var(--text-muted)",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Aucun mot-clé importé</div>
                  <div style={{ fontSize: 13 }}>Cliquez sur "Feed RSS" pour auto-import, ou "XML Manuel" pour coller le contenu.</div>
                </div>
              ) : (
                <div style={{
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                        {["", "Mot-clé", "Ligue", "Date match", "Position", "Δ", "URL", "📈"].map((h, hi) => (
                          <th key={h} style={{
                            padding: "10px 14px", textAlign: "left", fontSize: 10,
                            color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: 1, fontWeight: 700,
                          }}>{hi === 0 ? (
                            <input type="checkbox"
                              checked={filteredKws.length > 0 && filteredKws.every((k) => selectedKws[activeMarket]?.has(k.title))}
                              onChange={() => selectAll(activeMarket, filteredKws)}
                              style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }}
                            />
                          ) : h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKws.map((kw, i) => {
                        const result = lastScan?.results.find((r) => r.keyword === kw.title);
                        const pos = result?.position;
                        return (
                          <tr key={i} style={{
                            borderBottom: "1px solid var(--border)",
                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                          }}>
                            <td style={{ padding: "10px 14px", width: 36 }}>
                              <input type="checkbox"
                                checked={!!(selectedKws[activeMarket]?.has(kw.title))}
                                onChange={() => toggleSelect(activeMarket, kw.title)}
                                style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 13, maxWidth: 280 }}>
                              <a href={kw.link} target="_blank" rel="noopener noreferrer"
                                style={{ color: "var(--text)", textDecoration: "none", display: "block" }}
                                onMouseEnter={(e) => e.target.style.color = "var(--accent)"}
                                onMouseLeave={(e) => e.target.style.color = "var(--text)"}
                              >{kw.title}</a>
                              {result?.searchQuery && (
                                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                  🔍 {result.searchQuery}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                              {kw.ligue || "—"}
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                              {kw.matchDate ? kw.matchDate.slice(0, 16) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {result ? (
                                  <span style={{
                                    display: "inline-block", padding: "3px 10px", borderRadius: 6,
                                    background: posBg(pos), color: posColor(pos),
                                    fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
                                  }}>{pos ? `#${pos}` : (result?.inNewsBox ? "—" : ">T10")}</span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                                )}
                                {result?.isFeatured && (
                                  <span style={{
                                    display: "inline-block", padding: "2px 7px", borderRadius: 5,
                                    background: "rgba(255,170,0,0.15)", color: "var(--yellow)",
                                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                  }}>⭐ P0</span>
                                )}
                                {result?.inNewsBox && (
                                  <span style={{
                                    display: "inline-block", padding: "2px 7px", borderRadius: 5,
                                    background: "rgba(162,89,255,0.15)", color: "var(--accent3)",
                                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                  }}>📰 NEWS{result.newsPosition ? ` #${result.newsPosition}` : ""}</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <Delta scans={hist.scans} keyword={kw.title} />
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {result?.foundUrl ? (
                                <a href={result.foundUrl} target="_blank" rel="noopener noreferrer"
                                  style={{ color: "var(--accent)", textDecoration: "none", fontFamily: "var(--font-mono)" }}
                                >↗ {result.foundUrl.replace(/https?:\/\/[^/]+/, "")}</a>
                              ) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                {hist.scans.length > 0 && (
                                  <button onClick={() => setHistoryModal({ keyword: kw.title })} style={{
                                    background: "none", border: "1px solid var(--border)", borderRadius: 6,
                                    color: "var(--text-muted)", padding: "3px 8px", fontSize: 12,
                                  }}>📈</button>
                                )}
                                {result?.serp && (
                                  <button onClick={() => setSerpModal(result)} style={{
                                    background: "none", border: "1px solid var(--border)", borderRadius: 6,
                                    color: "var(--accent3)", padding: "3px 8px", fontSize: 12,
                                  }}>SERP</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {historyModal && (
        <HistoryModal
          keyword={historyModal.keyword}
          scans={hist.scans}
          onClose={() => setHistoryModal(null)}
        />
      )}
      {serpModal && (
        <SerpModal
          result={serpModal}
          onClose={() => setSerpModal(null)}
        />
      )}
      {xmlModal && (
        <XmlModal
          market={xmlModal}
          onClose={() => setXmlModal(null)}
          onImport={handleXmlImport}
        />
      )}
    </div>
  );
}

// ── HISTORY TAB ──
function HistoryTab({ hist }) {
  if (!hist.scans.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", flexDirection: "column", gap: 12, color: "var(--text-muted)" }}>
        <div style={{ fontSize: 32 }}>📊</div>
        <div>Aucun scan enregistré pour ce marché.</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>Historique des scans</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {[...hist.scans].reverse().map((scan, i) => {
          const found = scan.results.filter((r) => r.position).length;
          const top10 = scan.results.filter((r) => r.position && r.position <= 10).length;
          return (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
            }}>
              <div style={{
                padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface2)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{fmt(scan.timestamp)}</div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: "var(--green)" }}>✓ {found} positionnés</span>
                  <span style={{ color: "var(--accent)" }}>Top 10 : {top10}</span>
                  <span style={{ color: "var(--text-muted)" }}>{scan.results.length} total</span>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {scan.results.map((r, j) => (
                      <tr key={j} style={{ borderBottom: "1px solid rgba(42,42,62,0.5)" }}>
                        <td style={{ padding: "7px 16px", fontSize: 12 }}>{r.keyword}</td>
                        <td style={{ padding: "7px 16px", width: 80, textAlign: "center" }}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 5,
                            background: posBg(r.position), color: posColor(r.position),
                            fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                          }}>{r.position ? `#${r.position}` : (r.inNewsBox ? "—" : ">T10")}</span>
                        </td>
                        <td style={{ padding: "7px 16px", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {r.foundUrl || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

