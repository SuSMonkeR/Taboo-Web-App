// frontend/src/components/OwnerTab.jsx
import { useEffect, useState } from "react";
import { API_BASE, authHeaders, handleJsonResponse } from "../api/library";

export default function OwnerTab({ role, token }) {
  const [ownerExists, setOwnerExists] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Setup form (for when no owner exists)
  const [setupDisplayName, setSetupDisplayName] = useState("");
  const [setupPassword, setSetupPassword] = useState("");

  // Transfer ownership form
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDisplayName, setTransferDisplayName] = useState("");
  const [transferPassword, setTransferPassword] = useState("");

  // Update profile form
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Update password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const api = async (path, opts = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    
    // Add auth header if token is available and not already provided
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
    });
    return handleJsonResponse(resp);
  };

  // Check if owner exists and load owner info
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        // Check if owner exists (public endpoint)
        const existsData = await fetch(`${API_BASE}/auth/owner-exists`).then(r => r.json());
        
        if (cancelled) return;
        setOwnerExists(existsData.exists);

        // If owner exists and user is owner/dev, get owner info
        if (existsData.exists && (role === "owner" || role === "dev")) {
          const info = await api("/auth/owner-info", { method: "GET" });
          if (!cancelled) {
            setOwnerInfo(info);
            setEditDisplayName(info.display_name || "");
            setEditEmail(info.email || "");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load owner information.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, token]);

  const handleCreateOwner = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!setupDisplayName.trim()) {
      setError("Display name is required.");
      return;
    }

    if (!setupPassword || setupPassword.length < 3) {
      setError("Password must be at least 3 characters.");
      return;
    }

    try {
      await api("/auth/create-owner", {
        method: "POST",
        body: JSON.stringify({
          display_name: setupDisplayName.trim(),
          password: setupPassword,
        }),
      });

      setSuccessMessage("Owner created successfully! Please log in with the new credentials.");
      setSetupDisplayName("");
      setSetupPassword("");
      
      // Refresh page to show new owner UI
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e?.message || "Failed to create owner.");
    }
  };

  const handleTransferOwner = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!transferDisplayName.trim()) {
      setError("Display name is required.");
      return;
    }

    if (!transferPassword || transferPassword.length < 3) {
      setError("Password must be at least 3 characters.");
      return;
    }

    if (!window.confirm(`Transfer ownership to "${transferDisplayName}"? You will become an admin.`)) {
      return;
    }

    try {
      await api("/auth/transfer-owner", {
        method: "POST",
        body: JSON.stringify({
          new_display_name: transferDisplayName.trim(),
          new_password: transferPassword,
        }),
      });

      setSuccessMessage("Ownership transferred! Logging out...");
      setShowTransferModal(false);
      
      // Log out after transfer (user is no longer owner)
      setTimeout(() => {
        window.localStorage.clear();
        window.location.reload();
      }, 1500);
    } catch (e) {
      setError(e?.message || "Failed to transfer ownership.");
    }
  };

  const handleRelinquishOwner = async () => {
    if (!window.confirm("Are you sure you want to give up ownership? You will become an admin.")) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await api("/auth/relinquish-owner", { method: "POST" });

      setSuccessMessage("Ownership relinquished. Logging out...");
      
      // Log out after relinquishing (user is no longer owner)
      setTimeout(() => {
        window.localStorage.clear();
        window.location.reload();
      }, 1500);
    } catch (e) {
      setError(e?.message || "Failed to relinquish ownership.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    try {
      await api("/auth/update-owner-profile", {
        method: "PUT",
        body: JSON.stringify({
          display_name: editDisplayName.trim() || null,
          email: editEmail.trim() || null,
        }),
      });

      setSuccessMessage("Profile updated! Please log out and back in to see changes.");
      
      // Refresh owner info
      const info = await api("/auth/owner-info", { method: "GET" });
      setOwnerInfo(info);
      setEditDisplayName(info.display_name || "");
      setEditEmail(info.email || "");
    } catch (e) {
      setError(e?.message || "Failed to update profile.");
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!newPassword || newPassword.length < 3) {
      setError("Password must be at least 3 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await api("/auth/update-owner-password", {
        method: "PUT",
        body: JSON.stringify({
          new_password: newPassword,
        }),
      });

      setSuccessMessage("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e?.message || "Failed to update password.");
    }
  };

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Only dev can see this tab if no owner exists
  if (!ownerExists && role !== "dev") {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2>Owner Tab</h2>
          <p>No owner exists. Contact your dev.</p>
        </div>
      </div>
    );
  }

  // Dev sees setup form if no owner exists
  if (!ownerExists && role === "dev") {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Owner Setup</h2>
          <p style={styles.helpText}>
            No owner currently exists. Create an owner account to manage the server.
          </p>

          <form onSubmit={handleCreateOwner} style={styles.form}>
            <label style={styles.label}>
              Display Name
              <input
                type="text"
                value={setupDisplayName}
                onChange={(e) => setSetupDisplayName(e.target.value)}
                style={styles.input}
                placeholder="e.g., Foxie"
                autoFocus
              />
            </label>

            <label style={styles.label}>
              Password
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter password"
              />
            </label>

            <button type="submit" style={styles.primaryButton}>
              Create Owner Account
            </button>
          </form>

          {error && <p style={styles.error}>{error}</p>}
          {successMessage && <p style={styles.success}>{successMessage}</p>}
        </div>
      </div>
    );
  }

  // Owner or Dev sees management UI
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Owner Controls</h2>
        
        {ownerInfo && (
          <div style={styles.infoBox}>
            <div><strong>Current Owner:</strong> {ownerInfo.display_name}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "0.25rem" }}>
              Email: {ownerInfo.email || "Not set"}
            </div>
          </div>
        )}

        {/* Transfer Ownership */}
        <section style={styles.section}>
          <h3 style={styles.subheading}>Transfer Ownership</h3>
          <p style={styles.helpText}>
            Create a new owner account. You will become an admin.
          </p>

          {!showTransferModal ? (
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setShowTransferModal(true)}
            >
              Transfer Ownership
            </button>
          ) : (
            <form onSubmit={handleTransferOwner} style={styles.form}>
              <label style={styles.label}>
                New Owner Display Name
                <input
                  type="text"
                  value={transferDisplayName}
                  onChange={(e) => setTransferDisplayName(e.target.value)}
                  style={styles.input}
                  placeholder="e.g., SaveMart"
                />
              </label>

              <label style={styles.label}>
                New Owner Password
                <input
                  type="password"
                  value={transferPassword}
                  onChange={(e) => setTransferPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Enter password"
                />
              </label>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" style={styles.primaryButton}>
                  Confirm Transfer
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferDisplayName("");
                    setTransferPassword("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <hr style={styles.divider} />

        {/* Relinquish Ownership */}
        {role === "owner" && (
          <>
            <section style={styles.section}>
              <h3 style={styles.subheading}>Relinquish Ownership</h3>
              <p style={styles.helpText}>
                Give up ownership voluntarily. You will become an admin.
              </p>

              <button
                type="button"
                style={styles.dangerButton}
                onClick={handleRelinquishOwner}
              >
                Relinquish Ownership
              </button>
            </section>

            <hr style={styles.divider} />
          </>
        )}

        {/* Update Profile */}
        {role === "owner" && (
          <>
            <section style={styles.section}>
              <h3 style={styles.subheading}>Update Profile</h3>
              <p style={styles.helpText}>
                Change your display name or email address.
              </p>

              <form onSubmit={handleUpdateProfile} style={styles.form}>
                <label style={styles.label}>
                  Display Name
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    style={styles.input}
                    placeholder="Display name"
                  />
                </label>

                <label style={styles.label}>
                  Email (for password recovery)
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={styles.input}
                    placeholder="your@email.com"
                  />
                </label>

                <button type="submit" style={styles.primaryButton}>
                  Update Profile
                </button>
              </form>
            </section>

            <hr style={styles.divider} />
          </>
        )}

        {/* Update Password */}
        {role === "owner" && (
          <section style={styles.section}>
            <h3 style={styles.subheading}>Change Password</h3>
            <p style={styles.helpText}>
              Update your owner password.
            </p>

            <form onSubmit={handleUpdatePassword} style={styles.form}>
              <label style={styles.label}>
                New Password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Enter new password"
                />
              </label>

              <label style={styles.label}>
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Confirm password"
                />
              </label>

              <button type="submit" style={styles.primaryButton}>
                Change Password
              </button>
            </form>
          </section>
        )}

        {error && <p style={styles.error}>{error}</p>}
        {successMessage && <p style={styles.success}>{successMessage}</p>}
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
  input: {
    width: "100%",
    padding: "0.5rem 0.6rem",
    fontSize: "0.95rem",
    borderRadius: 6,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "#050816",
    color: "#e5e7eb",
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
  dangerButton: {
    marginTop: "0.5rem",
    padding: "0.6rem 0.8rem",
    fontSize: "0.95rem",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
  },
  helpText: { fontSize: "0.9rem", color: "rgba(148,163,184,0.9)" },
  infoBox: {
    padding: "0.75rem 1rem",
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: 8,
    marginBottom: "1.5rem",
  },
  divider: {
    border: "none",
    borderTop: "1px solid rgba(148,163,184,0.35)",
    margin: "1.25rem 0",
  },
  error: { marginTop: "0.75rem", color: "#f97373", fontSize: "0.9rem" },
  success: { marginTop: "0.5rem", color: "#4ade80", fontSize: "0.9rem" },
};