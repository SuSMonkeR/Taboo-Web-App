// frontend/src/api/library.js
const API_BASE = "http://127.0.0.1:8000";

// If you’re already storing the auth token somewhere else, adapt this:
function getToken() {
  return window.localStorage.getItem("taboo_token") || "";
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleJsonResponse(resp) {
  if (!resp.ok) {
    let msg = "Request failed";
    try {
      const data = await resp.json();
      if (data && data.detail) msg = data.detail;
    } catch {
      msg = await resp.text();
    }
    throw new Error(msg || "Request failed");
  }
  return resp.json();
}

// -------- AUTH --------
export async function loginWithPassword(password) {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await handleJsonResponse(resp);
  if (data && data.token) {
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

  // Only send name/category if provided
  if (name && name.trim()) {
    body.name = name.trim();
  }
  if (category && category.trim()) {
    body.category = category.trim();
  }

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
