import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { analytics } from "@heycatch/sdk";

analytics.init({
  projectKey: "hck_pk_MNcTEulldHmuxK7QqFmvyrNSHx3xwqd4",
  install: { framework: "vite-react", frameworkVersion: "19", agent: "claude-code" },
});


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
