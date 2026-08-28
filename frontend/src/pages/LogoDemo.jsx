// Luxury refined rings
function LuxuryRings({ strokeWidth = 2.5, scale = 1 }) {
  const size = 60 * scale;
  const h = Math.round(size * 48 / 52);
  return (
    <svg width={size} height={h} viewBox="0 0 52 48" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="26" cy="13" r="12" fill="none" stroke="#10B981" strokeWidth={strokeWidth} />
      <circle cx="14" cy="34" r="12" fill="none" stroke="#F97316" strokeWidth={strokeWidth} />
      <circle cx="38" cy="34" r="12" fill="none" stroke="#2563EB" strokeWidth={strokeWidth} />
    </svg>
  );
}

// LAX Sports Brand Concept Variations

// 1. NFL-style: Bold, blocked, powerful
function LaxNFL() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.85 }}>
        <span style={{ fontSize: "44px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-1px" }}>VEN</span>
        <span style={{ fontSize: "44px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-2px", textTransform: "uppercase", fontStyle: "italic" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
        <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#F97316", letterSpacing: "1.5px" }}>SPORTS</span>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
      </div>
    </div>
  );
}

// 2. NBA-style: Sleek, modern, dynamic
function LaxNBA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.85, alignItems: "baseline" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-1px" }}>VEN</span>
        <span style={{ fontSize: "48px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-3px" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
        <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#F97316", letterSpacing: "1.5px" }}>SPORTS</span>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
      </div>
    </div>
  );
}

// 3. Premier League-style: Elegant, established, serif-influenced
function LaxPL() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.9 }}>
        <span style={{ fontSize: "42px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-0.5px" }}>VEN</span>
        <span style={{ fontSize: "42px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-0.5px", fontStyle: "italic" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
        <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#F97316", letterSpacing: "1.5px" }}>SPORTS</span>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
      </div>
    </div>
  );
}

// 4. MLB-style: Classic, strong serifs feel, heritage
function LaxMLB() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.85 }}>
        <span style={{ fontSize: "38px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "0px" }}>VEN</span>
        <span style={{ fontSize: "46px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-1.5px", textTransform: "uppercase" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
        <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: "#F97316", letterSpacing: "1.5px" }}>SPORTS</span>
        <div style={{ width: "24px", height: "1.5px", background: "#F97316" }} />
      </div>
    </div>
  );
}

// 5. UFC-style: Aggressive, bold, impact-heavy
function LaxUFC() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.8 }}>
        <span style={{ fontSize: "44px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-2px" }}>VEN</span>
        <span style={{ fontSize: "44px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#F97316", letterSpacing: "-2px", textTransform: "uppercase" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "2px" }}>
        <div style={{ width: "24px", height: "2px", background: "#004D40" }} />
        <span style={{ fontSize: "12px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "2px" }}>SPORTS</span>
        <div style={{ width: "24px", height: "2px", background: "#004D40" }} />
      </div>
    </div>
  );
}

// 6. Champions League-style: Premium, sophisticated, European
function LaxCL() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "12px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.95, gap: "3px" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-0.5px" }}>VEN</span>
        <span style={{ fontSize: "40px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-0.5px" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "28px", height: "2px", background: "#F97316" }} />
        <span style={{ fontSize: "11px", fontWeight: 800, fontFamily: "'DM Sans', sans-serif", color: "#F97316", letterSpacing: "2px", textTransform: "uppercase" }}>Premium</span>
        <div style={{ width: "28px", height: "2px", background: "#F97316" }} />
      </div>
    </div>
  );
}

// 7. Esports-style: Tech-forward, futuristic, angular
function LaxEsports() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "10px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.85, transform: "skewX(-8deg)" }}>
        <span style={{ fontSize: "44px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-1.5px" }}>VEN</span>
        <span style={{ fontSize: "44px", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-1.5px" }}>LAX</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
        <div style={{ width: "3px", height: "3px", background: "#F97316" }} />
        <span style={{ fontSize: "11px", fontWeight: 800, fontFamily: "'DM Sans', sans-serif", color: "#F97316", letterSpacing: "2px" }}>LEAGUE</span>
        <div style={{ width: "3px", height: "3px", background: "#F97316" }} />
      </div>
    </div>
  );
}

// 8. Luxury-style: High-end, refined, minimalist
function LaxLuxury() {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: "14px", alignItems: "center" }}>
      <div style={{ display: "flex", lineHeight: 0.95 }}>
        <span style={{ fontSize: "42px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#10B981", letterSpacing: "-0.5px", fontVariant: "small-caps" }}>Ven</span>
        <span style={{ fontSize: "42px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#004D40", letterSpacing: "-0.5px", fontVariant: "small-caps" }}>Lax</span>
      </div>
      <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", color: "#F97316", letterSpacing: "2.5px" }}>ELITE SPORTS</span>
    </div>
  );
}

const brandConcepts = [
  { id: 1, Component: LaxNFL, label: "NFL-Style", desc: "Bold, blocked, italic accent" },
  { id: 2, Component: LaxNBA, label: "NBA-Style", desc: "Sleek, modern, dynamic sizing" },
  { id: 3, Component: LaxPL, label: "Premier League-Style", desc: "Elegant, established, italic" },
  { id: 4, Component: LaxMLB, label: "MLB-Style", desc: "Classic, strong, heritage feel" },
  { id: 5, Component: LaxUFC, label: "UFC-Style", desc: "Aggressive, bold, orange accent" },
  { id: 6, Component: LaxCL, label: "Champions League-Style", desc: "Premium, sophisticated, European" },
  { id: 7, Component: LaxEsports, label: "Esports-Style", desc: "Tech-forward, futuristic, angular" },
  { id: 8, Component: LaxLuxury, label: "Luxury-Style", desc: "High-end, refined, small-caps" },
];

export default function LogoDemo() {
  return (
    <div style={{ padding: "40px", background: "#FAFAFA", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center", marginBottom: "15px", color: "#004D40", fontSize: "36px", fontWeight: "800" }}>LAX: Major Sports Brand Styles</h1>
      <p style={{ textAlign: "center", color: "#6B7280", marginBottom: "80px", fontSize: "15px" }}>Inspired by NFL, NBA, Premier League, MLB, UFC, Champions League, Esports, Luxury brands.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "50px", maxWidth: "1900px", margin: "0 auto" }}>
        {brandConcepts.map((b) => (
          <div key={b.id} style={{ background: "white", padding: "60px 40px", borderRadius: "16px", border: "1px solid #E5E7EB", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "50px", minHeight: "180px", gap: "40px" }}>
              <LuxuryRings strokeWidth={2.5} scale={1.1} />
              <b.Component />
            </div>
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: "20px" }}>
              <p style={{ fontSize: "14px", color: "#004D40", fontWeight: "700", marginBottom: "6px" }}>Concept {b.id} — {b.label}</p>
              <p style={{ fontSize: "12px", color: "#6B7280", margin: 0 }}>{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "120px", padding: "50px", background: "linear-gradient(135deg, #F5F7FA 0%, #FAFBFC 100%)", borderRadius: "16px", border: "1px solid #E5E7EB", maxWidth: "900px", margin: "120px auto 0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <h2 style={{ color: "#004D40", marginTop: 0, marginBottom: "24px", fontSize: "20px", fontWeight: "800" }}>Pick Brand Concept</h2>
        <p style={{ color: "#4B5563", margin: "0 0 16px 0", fontSize: "15px", lineHeight: "1.6" }}>Reply with concept number (1-8) and I'll apply this major sports league style LAX treatment to VENLAX.</p>
        <p style={{ color: "#6B7280", fontSize: "13px", margin: 0, fontStyle: "italic" }}>Example: "2" applies NBA-Style sleek design</p>
      </div>
    </div>
  );
}
