// frontend/src/components/PasswordManagerTab.jsx
import { useEffect, useMemo, useState } from "react";
import { API_BASE, authHeaders, handleJsonResponse } from "../api/library";

export default function PasswordManagerTab({ token, role }) {
  const [currentStaffPassword, setCurrentStaffPassword] = useState("");
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [showNewStaffPassword, setShowNewStaffPassword] = useState(false);
  const [staffStatus, setStaffStatus] = useState("");

  const [resetRequestStatus, setResetRequestStatus] = useState("");
  const [adminResetToken, setAdminResetToken] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [adminResetStatus, setAdminResetStatus] = useState("");

  const [error, setError] = useState("");
  const [loadingStaffPassword, setLoadingStaffPassword] = useState(false);

  const isAdminLike = role === "admin" || role === "dev";

  // If you pass token as a prop, prefer it; otherwise fall back to localStorage behavior
  const mergedAuthHeaders = useMemo(() => {
    const base = authHeaders(); // reads localStorage taboo_token
    if (token) return { Authorization: `Bearer ${token}` };
    return base;
  }, [token]);

  const api = async (path, opts = {}) => {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
        ...mergedAuthHeaders,
      },
    });
    return handleJsonResponse(resp);
  };

  // --- Fetch current staff password on mount (admin/dev only) ---
  useEffect(() => {
    if (!isAdminLike) return;

    let cancelled = false;

    (async () => {
      setError("");
      setStaffStatus("");
      setLoadingStaffPassword(true);

      try {
        const data = await api("/auth/get-staff-password", { method: "GET" });
        if (!cancelled) setCurrentStaffPassword(data?.password || "");
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to fetch staff password.");
      } finally {
        if (!cancelled) setLoadingStaffPassword(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLike, token]);

  // --- Staff password change ---
  const handleStaffPasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setStaffStatus("");

    if (!newStaffPassword?.trim()) {
      setError("New staff password cannot be empty.");
      return;
    }

    try {
      await api("/auth/change-staff-password", {
        method: "POST",
        body: JSON.stringify({ new_password: newStaffPassword.trim() }),
      });

      setStaffStatus("Staff password updated.");
      setCurrentStaffPassword(newStaffPassword.trim());
      setNewStaffPassword("");
    } catch (e2) {
      setError(e2?.message || "Failed to update staff password.");
    }
  };

  // --- Request admin reset email ---
  const handleRequestAdminReset = async () => {
    setError("");
    setResetRequestStatus("");
    setAdminResetStatus("");

    try {
      await api("/auth/request-admin-reset", { method: "POST" });
      setResetRequestStatus(
        "If email is configured, a reset token has been sent to MiraFknJane."
      );
    } catch (e) {
      setError(e?.message || "Error requesting admin reset.");
    }
  };

  // --- Complete admin password reset (token from email) ---
  const handleCompleteAdminReset = async (e) => {
    e.preventDefault();
    setError("");
    setAdminResetStatus("");

    if (!adminResetToken?.trim() || !newAdminPassword?.trim()) {
      setError("Token and new admin password are required.");
      return;
    }

    try {
      // This endpoint should NOT require auth, so we do a direct fetch without auth headers.
      const resp = await fetch(`${API_BASE}/auth/reset-admin-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: adminResetToken.trim(),
          new_password: newAdminPassword.trim(),
        }),
      });

      await handleJsonResponse(resp);

      setAdminResetStatus("Admin password updated.");
      setAdminResetToken("");
      setNewAdminPassword("");
    } catch (e2) {
      setError(e2?.message || "Error resetting admin password.");
    }
  };

  if (!isAdminLike) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2>Password Manager</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Password Manager</h2>

        <section style={styles.section}>
          <h3 style={styles.subheading}>Staff password</h3>
          <p style={styles.helpText}>
            This password is used by all staff to access the Play tab.
          </p>

          <div style={styles.currentRow}>
            <span style={styles.labelInline}>Current password:</span>
            <input
              type={showStaffPassword ? "text" : "password"}
              value={currentStaffPassword}
              readOnly
              style={styles.currentInput}
              placeholder={loadingStaffPassword ? "Loading…" : ""}
            />
            <button
              type="button"
              style={styles.smallButton}
              onClick={() => setShowStaffPassword((v) => !v)}
              title={showStaffPassword ? "Hide" : "Show"}
              disabled={!currentStaffPassword}
            >
              {showStaffPassword ? "🙈" : "👁"}
            </button>
          </div>

          <form onSubmit={handleStaffPasswordChange} style={styles.form}>
            <label style={styles.label}>
              New staff password
              <div style={styles.passwordFieldWrapper}>
                <input
                  type={showNewStaffPassword ? "text" : "password"}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  style={{ ...styles.input, ...styles.inputPasswordLeft }}
                  placeholder="Enter new staff password"
                />
                <button
                  type="button"
                  style={styles.eyeButton}
                  onClick={() => setShowNewStaffPassword((v) => !v)}
                  title={showNewStaffPassword ? "Hide" : "Show"}
                >
                  {showNewStaffPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>

            <button type="submit" style={styles.primaryButton}>
              Update staff password
            </button>
          </form>

          {staffStatus && <p style={styles.success}>{staffStatus}</p>}
        </section>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <h3 style={styles.subheading}>Admin password reset</h3>
          <p style={styles.helpText}>
            Only MiraFknJane (via the configured email) can approve an admin
            password change.
          </p>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleRequestAdminReset}
          >
            Send reset email to MiraFknJane
          </button>

          {resetRequestStatus && <p style={styles.success}>{resetRequestStatus}</p>}

          <div style={{ marginTop: "1.5rem" }}>
            <p style={styles.helpText}>
              When MiraFknJane receives the reset token, paste it here with the new
              admin password:
            </p>

            <form onSubmit={handleCompleteAdminReset} style={styles.form}>
              <label style={styles.label}>
                Reset token
                <input
                  type="text"
                  value={adminResetToken}
                  onChange={(e) => setAdminResetToken(e.target.value)}
                  style={styles.input}
                  placeholder="Paste token from email"
                />
              </label>

              <label style={styles.label}>
                New admin password
                <div style={styles.passwordFieldWrapper}>
                  <input
                    type={showNewAdminPassword ? "text" : "password"}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    style={{ ...styles.input, ...styles.inputPasswordLeft }}
                    placeholder="Enter new admin password"
                  />
                  <button
                    type="button"
                    style={styles.eyeButton}
                    onClick={() => setShowNewAdminPassword((v) => !v)}
                    title={showNewAdminPassword ? "Hide" : "Show"}
                  >
                    {showNewAdminPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </label>

              <button type="submit" style={styles.primaryButton}>
                Set new admin password
              </button>
            </form>

            {adminResetStatus && <p style={styles.success}>{adminResetStatus}</p>}
          </div>
        </section>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { padding: "1.5rem" },
  card: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "1.5rem 2rem",
    borderRadius: 12,
    background: "#0f1624",
    boxShadow: "0 0 0 1px rgba(148,163,184,0.25)",
    color: "#e5e7eb",
  },
  heading: { margin: "0 0 1rem 0", fontSize: "1.35rem" },
  subheading: { margin: "0 0 0.5rem 0", fontSize: "1rem" },
  section: { marginBottom: "1.5rem" },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    fontSize: "0.9rem",
    gap: "0.25rem",
  },
  labelInline: { fontSize: "0.9rem", marginRight: "0.5rem" },
  currentRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  currentInput: {
    flexGrow: 1,
    padding: "0.4rem 0.6rem",
    fontSize: "0.95rem",
    borderRadius: 6,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "#050816",
    color: "#e5e7eb",
  },
  input: {
    width: "100%",
    padding: "0.5rem 0.6rem",
    fontSize: "0.95rem",
    borderRadius: 6,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "#050816",
    color: "#e5e7eb",
  },
  inputPasswordLeft: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  passwordFieldWrapper: { display: "flex", alignItems: "center", width: "100%" },
  eyeButton: {
    padding: "0.5rem 0.7rem",
    border: "1px solid rgba(148,163,184,0.6)",
    borderLeft: "none",
    background: "#111827",
    color: "#e5e7eb",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
  },
  primaryButton: {
    marginTop: "0.5rem",
    padding: "0.6rem 0.8rem",
    fontSize: "0.95rem",
    background: "#22c55e",
    color: "#020617",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
    alignSelf: "flex-start",
    fontWeight: 600,
  },
  secondaryButton: {
    marginTop: "0.5rem",
    padding: "0.6rem 0.8rem",
    fontSize: "0.95rem",
    background: "#1f2937",
    color: "#e5e7eb",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
  },
  smallButton: {
    padding: "0.35rem 0.6rem",
    fontSize: "0.8rem",
    background: "#111827",
    color: "#e5e7eb",
    border: "1px solid rgba(148,163,184,0.6)",
    borderRadius: 999,
    cursor: "pointer",
  },
  helpText: { fontSize: "0.9rem", color: "rgba(148,163,184,0.9)" },
  divider: {
    border: "none",
    borderTop: "1px solid rgba(148,163,184,0.35)",
    margin: "1.25rem 0",
  },
  error: { marginTop: "0.75rem", color: "#f97373", fontSize: "0.9rem" },
  success: { marginTop: "0.5rem", color: "#4ade80", fontSize: "0.9rem" },
};
