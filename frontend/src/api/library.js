// frontend/src/api/library.js

// ✅ Backend base URL:
// - Local dev can fall back to localhost
// - Prod MUST have VITE_BACKEND_URL baked at build time
const ENV_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_BACKEND_URL) ||
  "";

// ✅ Only allow localhost fallback when the page itself is running on localhost.
// In production, fail loudly if ENV_BASE is missing so we never silently call 127.0.0.1 again.
export const API_BASE =
  ENV_BASE ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : (() => {
        throw new Error(
          "Missing VITE_BACKEND_URL in production build (frontend Render service env)."
        );
      })());

// Simple token getter; tweak if you ever change storage key
function getToken() {
  return window.localStorage.getItem("taboo_token") || "";
}

/**
 * Return Authorization header if we have a token.
 */
export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Common JSON response handler.
 * Throws an Error with any .detail or .message from the backend if status is not ok.
 */
export async function handleJsonResponse(resp) {
  if (!resp.ok) {
    let msg = "Request failed";
    try {
      const data = await resp.json();
      if (data?.detail) msg = data.detail;
      else if (data?.message) msg = data.message;
    } catch {
      try {
        msg = await resp.text();
      } catch {
        // ignore
      }
    }
    throw new Error(msg || "Request failed");
  }

  // Handle 204 No Content safely
  if (resp.status === 204) return null;

  // Some endpoints might return empty body even on 200
  const text = await resp.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // If backend ever returns plain text on success
    return text;
  }
}

// -------- AUTH --------

export async function loginWithPassword(password) {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await handleJsonResponse(resp);

  if (data?.token) {
    window.localStorage.setItem("taboo_token", data.token);
  }

  return data;
}

// -------- LIBRARY --------

export async function fetchDeckState() {
  const resp = await fetch(`${API_BASE}/library/decks-state`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleJsonResponse(resp);
}

/**
 * Import a deck from a URL.
 *
 * @param {string} url  CSV/Sheets URL
 * @param {string} name Deck name (optional)
 * @param {string|null} category Category name (optional)
 * @param {number} tabooWordsPerCard How many taboo words per card (default 4)
 */
export async function importDeckFromUrl(
  url,
  name,
  category = null,
  tabooWordsPerCard = 4
) {
  const body = {
    url,
    taboo_words_per_card: Number.isFinite(tabooWordsPerCard)
      ? tabooWordsPerCard
      : 4,
  };

  if (name && name.trim()) body.name = name.trim();
  if (category && category.trim()) body.category = category.trim();

  const resp = await fetch(`${API_BASE}/library/decks/from-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  return handleJsonResponse(resp);
}

export async function createCategory(name) {
  const resp = await fetch(`${API_BASE}/library/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ name }),
  });
  return handleJsonResponse(resp);
}

export async function deleteCategory(name) {
  const encoded = encodeURIComponent(name);
  const resp = await fetch(`${API_BASE}/library/categories/${encoded}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleJsonResponse(resp);
}

export async function moveDeck(deckId, category) {
  const resp = await fetch(`${API_BASE}/library/decks/${deckId}/category`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ category }),
  });
  return handleJsonResponse(resp);
}

export async function deleteDeck(deckId) {
  const resp = await fetch(`${API_BASE}/library/decks/${deckId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleJsonResponse(resp);
}
