import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bell } from "lucide-react";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const POLL_MS = 60000;

/** In-app notifications: unread count on the bell, latest items in a dropdown. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/inbox`, { withCredentials: true });
      setData(d);
    } catch { /* the bell is optional: stay quiet if it cannot load */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      axios.post(`${API}/inbox/${n.id}/read`, {}, { withCredentials: true }).then(load).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    try { await axios.post(`${API}/inbox/read-all`, {}, { withCredentials: true }); } catch { /* ignore */ }
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative p-2 text-gray-700 hover:bg-gray-50 rounded-lg"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ""}`}
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5" />
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#008F70", borderRadius: 9 }} data-testid="notification-unread">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-80 max-w-[calc(100vw-2rem)] bg-white z-50 shadow-lg" style={{ border: "1px solid #E5E7EB" }} data-testid="notification-menu">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <p className="font-heading font-bold text-sm" style={{ color: "#1D1D1D" }}>Notifications</p>
            {data.unread > 0 && <button onClick={readAll} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="notification-read-all">Mark all read</button>}
          </div>
          {data.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "#6B7280" }}>Nothing yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: "#F3F4F6" }}>
              {data.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className="w-full text-left px-4 py-3 hover:bg-gray-50" style={n.read ? undefined : { background: "#F4FBF9" }} data-testid={`notification-${n.id}`}>
                    <p className="text-sm font-semibold" style={{ color: "#1D1D1D" }}>{n.title}</p>
                    {n.body && <p className="text-xs mt-0.5" style={{ color: "#4C4C4C" }}>{n.body}</p>}
                    <p className="text-[11px] mt-1" style={{ color: "#6B7280" }}>{new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
