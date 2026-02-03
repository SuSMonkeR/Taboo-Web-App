import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 🔥 Wake backend immediately (fire-and-forget)
try {
  fetch(import.meta.env.VITE_API_BASE_URL + "/health", {
    method: "GET",
    credentials: "include",
  }).catch(() => {});
} catch {}

// Render app immediately — do NOT wait for backend
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
