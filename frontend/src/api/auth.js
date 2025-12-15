// frontend/src/api/auth.js
import { API_BASE, handleJsonResponse } from "./library";

/**
 * Attempt login with a single shared password.
 *
 * On success, returns:
 *   { token: string, role: "staff" | "admin" | "dev" }
 *
 * On failure, throws Error("...") with backend detail/message if available.
 */
export async function login(password) {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await handleJsonResponse(resp);

  // Keep behavior consistent with loginWithPassword:
  if (data?.token) {
    window.localStorage.setItem("taboo_token", data.token);
  }

  return data;
}
