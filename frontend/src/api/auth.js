const API_BASE = "http://127.0.0.1:8000";
// If you prefer "http://localhost:8000" and it matches your other API files, that's fine too.

/**
 * Attempt login with a single shared password.
 *
 * On success, returns:
 *   { token: string, role: "staff" | "admin" | "dev" }
 *
 * On failure, throws Error("...").
 */
export async function login(password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Backend returns { detail: "Invalid password." } on 401
    const message = (data && data.detail) || "Login failed";
    throw new Error(message);
  }

  // Expect shape: { token: string, role: "staff" | "admin" | "dev" }
  return data;
}
