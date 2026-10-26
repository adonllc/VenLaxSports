import { useEffect, useState } from "react";
import axios from "axios";

const BASE = import.meta.env.VITE_BACKEND_URL;

function RecapCard({ recap }) {
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);

  // the card is private to its player, so it is fetched with the login cookie and shown from memory
  useEffect(() => {
    let made;
    axios.get(`${BASE}${recap.image_url}`, { withCredentials: true, responseType: "blob" })
      .then((r) => { setBlob(r.data); made = URL.createObjectURL(r.data); setUrl(made); })
      .catch(() => {});
    return () => { if (made) URL.revokeObjectURL(made); };
  }, [recap.image_url]);

  const share = async () => {
    const file = new File([blob], "venlax-season-recap.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "My VENLAX season", url: "https://venlaxsports.com" });
    } catch { /* the player closed the share sheet */ }
  };

  return (
    <div className="bg-white p-4" style={{ border: "1px solid #E5E7EB" }} data-testid="recap-card">
      <p className="text-sm font-semibold mb-2" style={{ color: "#3D3D3D" }}>{recap.league_name}</p>
      {url ? <img src={url} alt={`Season recap for ${recap.league_name}: rank ${recap.rank} of ${recap.players}, record ${recap.wins}-${recap.losses}`} className="w-full max-w-xs mx-auto" /> : <div className="h-64 bg-gray-100" aria-busy="true" />}
      <div className="mt-3 flex gap-2 justify-center">
        {url && <a href={url} download="venlax-season-recap.png" className="text-xs font-semibold px-3 py-2 text-white" style={{ background: "#008F70" }} data-testid="recap-download">Download</a>}
        {blob && typeof navigator !== "undefined" && navigator.canShare && (
          <button onClick={share} className="text-xs font-semibold px-3 py-2" style={{ border: "1px solid #008F70", color: "#008F70" }} data-testid="recap-share">Share</button>
        )}
      </div>
    </div>
  );
}

/** Season recap cards of the leagues this player has finished. Renders nothing until there is one. */
export default function SeasonRecaps() {
  const [recaps, setRecaps] = useState([]);
  useEffect(() => {
    axios.get(`${BASE}/api/recaps/mine`, { withCredentials: true }).then((r) => setRecaps(r.data.recaps)).catch(() => {});
  }, []);
  if (recaps.length === 0) return null;
  return (
    <section className="mb-6" aria-labelledby="recaps-heading" data-testid="season-recaps">
      <h2 id="recaps-heading" className="text-lg font-semibold mb-3" style={{ color: "#3D3D3D" }}>Your season recaps</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recaps.map((r) => <RecapCard key={r.league_id} recap={r} />)}
      </div>
    </section>
  );
}
