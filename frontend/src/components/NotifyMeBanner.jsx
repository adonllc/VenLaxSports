import { useState } from "react";
import { Bell } from "lucide-react";
import NotifyMeModal from "./NotifyMeModal";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function NotifyMeBanner({ city, sport }) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (user) {
      // Logged-in: one-click subscribe
      setLoading(true);
      try {
        await axios.post(`${API}/notifications/subscribe`, {
          city,
          sport,
          channels: ["email", "push"],
        }, { withCredentials: true });
        setSubscribed(true);
        // Request push permission + register
        if ("Notification" in window && Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "granted") {
            await _registerPush();
          }
        }
      } catch (e) {
        console.error("Subscribe failed", e);
      } finally {
        setLoading(false);
      }
    } else {
      setModalOpen(true);
    }
  };

  if (subscribed) {
    return (
      <div
        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3"
        data-testid="notify-banner-success"
      >
        <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700 font-medium">
          You're on the list! We'll notify you when {city} {sport} opens.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4"
        data-testid="notify-me-banner"
      >
        <div className="flex items-center gap-3">
          <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">No open leagues right now</p>
            <p className="text-xs text-emerald-600">
              Get notified when a {city} {sport} season opens
            </p>
          </div>
        </div>
        <button
          onClick={handleClick}
          disabled={loading}
          className="shrink-0 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60"
          data-testid="notify-me-banner-btn"
        >
          {loading ? "..." : "Notify Me"}
        </button>
      </div>

      <NotifyMeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        city={city}
        sport={sport}
      />
    </>
  );
}

async function _registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(vapidKey),
    });
    const subJson = sub.toJSON();
    await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/notifications/push-subscription`, {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }, { withCredentials: true });
  } catch (e) {
    console.warn("Push registration failed", e);
  }
}

function _urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}
