// frontend/src/components/PasswordManagerTab.jsx
// NOW: Account Management - Create, edit, and manage user accounts

import { useEffect, useState, useMemo } from "react";
import { API_BASE, authHeaders, handleJsonResponse } from "../api/library";

export default function PasswordManagerTab({ token, role }) {
  // Account data
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    password: "",
    role: "operator",
  });
  const [passwordData, setPasswordData] = useState({
    new_password: "",
    confirm_password: "",
  });
  
  // Toast notification
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const isAdminLike = role === "admin" || role === "dev" || role === "owner";

  // Permission checker: Can current user modify this account?
  const canModifyAccount = (targetAccount) => {
    // Dev can do everything
    if (role === "dev") return true;
    
    // Can't modify owner accounts (except dev)
    if (targetAccount.role === "owner") return false;
    
    // Owner can modify admins and operators
    if (role === "owner") {
      return targetAccount.role === "admin" || targetAccount.role === "operator";
    }
    
    // Admin can ONLY modify operators (not other admins)
    if (role === "admin") {
      return targetAccount.role === "operator";
    }
    
    return false;
  };

  // Get reason why account can't be modified (for UI display)
  const getProtectionReason = (targetAccount) => {
    if (role === "dev") return null;
    
    if (targetAccount.role === "owner") return "Owner";
    
    if (role === "admin" && targetAccount.role === "admin") {
      return "Same Level";
    }
    
    if (role === "owner" && targetAccount.role === "owner") {
      return "Owner";
    }
    
    return "Protected";
  };

  const api = async (path, opts = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
    });
    return handleJsonResponse(resp);
  };

  // Fetch accounts on mount
  const fetchAccounts = async () => {
    setLoading(true);
    setError("");
    
    try {
      const data = await api("/auth/accounts", { method: "GET" });
      setAccounts(data.accounts || []);
    } catch (e) {
      setError(e?.message || "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminLike) {
      fetchAccounts();
    }
  }, [isAdminLike, token]);

  // Show toast notification
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = acc.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (acc.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filterRole === "all" || acc.role === filterRole;
      const matchesStatus = filterStatus === "all" || 
                           (filterStatus === "active" && acc.is_active) ||
                           (filterStatus === "disabled" && !acc.is_active);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, searchQuery, filterRole, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = accounts.length;
    const owners = accounts.filter(a => a.role === "owner").length;
    const admins = accounts.filter(a => a.role === "admin").length;
    const operators = accounts.filter(a => a.role === "operator").length;
    const inactive = accounts.filter(a => !a.is_active).length;
    
    return { total, owners, admins, operators, inactive };
  }, [accounts]);

  // Create account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!formData.display_name.trim()) {
      setError("Display name is required.");
      return;
    }
    
    if (!formData.password || formData.password.length < 3) {
      setError("Password must be at least 3 characters.");
      return;
    }
    
    try {
      await api("/auth/accounts", {
        method: "POST",
        body: JSON.stringify({
          display_name: formData.display_name.trim(),
          password: formData.password,
          role: formData.role,
          email: formData.email.trim() || null,
        }),
      });
      
      showToast(`Account "${formData.display_name}" created successfully!`);
      setShowCreateModal(false);
      setFormData({ display_name: "", email: "", password: "", role: "operator" });
      fetchAccounts();
    } catch (e) {
      setError(e?.message || "Failed to create account.");
    }
  };

  // Update account
  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!formData.display_name.trim()) {
      setError("Display name is required.");
      return;
    }
    
    try {
      await api(`/auth/accounts/${selectedAccount.account_id}`, {
        method: "PUT",
        body: JSON.stringify({
          display_name: formData.display_name.trim(),
          email: formData.email.trim() || null,
          role: formData.role,
        }),
      });
      
      showToast("Account updated successfully!");
      setShowEditModal(false);
      setSelectedAccount(null);
      fetchAccounts();
    } catch (e) {
      setError(e?.message || "Failed to update account.");
    }
  };

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!passwordData.new_password || passwordData.new_password.length < 3) {
      setError("Password must be at least 3 characters.");
      return;
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    
    try {
      await api(`/auth/accounts/${selectedAccount.account_id}/password`, {
        method: "PUT",
        body: JSON.stringify({ new_password: passwordData.new_password }),
      });
      
      showToast("Password reset successfully!");
      setShowPasswordModal(false);
      setPasswordData({ new_password: "", confirm_password: "" });
      setSelectedAccount(null);
    } catch (e) {
      setError(e?.message || "Failed to reset password.");
    }
  };

  // Disable/Enable account
  const handleToggleStatus = async (account) => {
    try {
      const endpoint = account.is_active ? "disable" : "enable";
      await api(`/auth/accounts/${account.account_id}/${endpoint}`, { method: "POST" });
      
      showToast(`Account ${account.is_active ? "disabled" : "enabled"} successfully!`);
      fetchAccounts();
    } catch (e) {
      showToast(e?.message || "Failed to update account status.", "error");
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    try {
      await api(`/auth/accounts/${selectedAccount.account_id}`, { method: "DELETE" });
      
      showToast("Account deleted successfully!");
      setShowDeleteModal(false);
      setSelectedAccount(null);
      fetchAccounts();
    } catch (e) {
      showToast(e?.message || "Failed to delete account.", "error");
    }
  };

  // Open edit modal
  const openEditModal = (account) => {
    setSelectedAccount(account);
    setFormData({
      display_name: account.display_name,
      email: account.email || "",
      role: account.role,
      password: "",
    });
    setShowEditModal(true);
  };

  // Open password reset modal
  const openPasswordModal = (account) => {
    setSelectedAccount(account);
    setPasswordData({ new_password: "", confirm_password: "" });
    setShowPasswordModal(true);
  };

  // Open delete modal
  const openDeleteModal = (account) => {
    setSelectedAccount(account);
    setShowDeleteModal(true);
  };

  if (!isAdminLike) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2>Account Management</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          ...styles.toast,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
        }}>
          {toast.message}
        </div>
      )}

      {/* Header with Stats */}
      <div style={styles.header}>
        <h2 style={styles.heading}>Account Management</h2>
        
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total Accounts</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: "#f59e0b" }}>{stats.owners}</div>
            <div style={styles.statLabel}>Owners</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: "#3b82f6" }}>{stats.admins}</div>
            <div style={styles.statLabel}>Admins</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: "#10b981" }}>{stats.operators}</div>
            <div style={styles.statLabel}>Operators</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: "#6b7280" }}>{stats.inactive}</div>
            <div style={styles.statLabel}>Inactive</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <input
          type="text"
          placeholder="🔍 Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
        
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="operator">Operator</option>
        </select>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        
        <button
          onClick={() => {
            setFormData({ display_name: "", email: "", password: "", role: "operator" });
            setShowCreateModal(true);
            setError("");
          }}
          style={styles.createButton}
        >
          ➕ Create Account
        </button>
      </div>

      {/* Accounts Table */}
      {loading ? (
        <div style={styles.card}>
          <p>Loading accounts...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div style={styles.card}>
          <p style={{ textAlign: "center", opacity: 0.7 }}>
            {searchQuery || filterRole !== "all" || filterStatus !== "all" 
              ? "No accounts match your filters." 
              : "No accounts yet. Create your first one!"}
          </p>
        </div>
      ) : (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => {
                const canModify = canModifyAccount(account);
                const protectionReason = getProtectionReason(account);
                
                return (
                  <tr key={account.account_id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.nameCell}>
                        <div style={{
                          ...styles.avatar,
                          background: account.role === "owner" ? "#f59e0b" :
                                     account.role === "admin" ? "#3b82f6" : "#10b981",
                        }}>
                          {account.display_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{account.display_name}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ opacity: 0.8, fontSize: "0.9rem" }}>
                        {account.email || "—"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: account.role === "owner" ? "rgba(245, 158, 11, 0.15)" :
                                   account.role === "admin" ? "rgba(59, 130, 246, 0.15)" : 
                                   "rgba(16, 185, 129, 0.15)",
                        color: account.role === "owner" ? "#f59e0b" :
                               account.role === "admin" ? "#3b82f6" : "#10b981",
                      }}>
                        {account.role === "owner" ? "👑 Owner" :
                         account.role === "admin" ? "🛡️ Admin" : "⚡ Operator"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusDot,
                        background: account.is_active ? "#10b981" : "#6b7280",
                      }} />
                      <span style={{ opacity: 0.8, fontSize: "0.9rem" }}>
                        {account.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                        {account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {canModify ? (
                        <div style={styles.actions}>
                          <button
                            onClick={() => openEditModal(account)}
                            style={styles.actionBtn}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => openPasswordModal(account)}
                            style={styles.actionBtn}
                            title="Reset Password"
                          >
                            🔑
                          </button>
                          <button
                            onClick={() => handleToggleStatus(account)}
                            style={styles.actionBtn}
                            title={account.is_active ? "Disable" : "Enable"}
                          >
                            {account.is_active ? "🚫" : "✅"}
                          </button>
                          <button
                            onClick={() => openDeleteModal(account)}
                            style={{ ...styles.actionBtn, color: "#ef4444" }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <span style={{ 
                          opacity: 0.5, 
                          fontSize: "0.85rem",
                          fontStyle: "italic",
                        }}>
                          {protectionReason}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalHeading}>Create New Account</h3>
            
            <form onSubmit={handleCreateAccount} style={styles.form}>
              <label style={styles.label}>
                Display Name *
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  style={styles.input}
                  placeholder="e.g., John Doe"
                  autoFocus
                />
              </label>
              
              <label style={styles.label}>
                Email
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={styles.input}
                  placeholder="optional@email.com"
                />
              </label>
              
              <label style={styles.label}>
                Password *
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={styles.input}
                  placeholder="Min 3 characters"
                />
              </label>
              
              <label style={styles.label}>
                Role *
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={styles.input}
                >
                  <option value="operator">Operator (Play only)</option>
                  {(role === "owner" || role === "dev") && (
                    <option value="admin">Admin (Full access)</option>
                  )}
                </select>
              </label>
              
              {error && <p style={styles.error}>{error}</p>}
              
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError("");
                  }}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton}>
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && selectedAccount && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalHeading}>Edit Account</h3>
            
            <form onSubmit={handleUpdateAccount} style={styles.form}>
              <label style={styles.label}>
                Display Name *
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  style={styles.input}
                />
              </label>
              
              <label style={styles.label}>
                Email
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={styles.input}
                />
              </label>
              
              <label style={styles.label}>
                Role *
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={styles.input}
                >
                  <option value="operator">Operator</option>
                  {(role === "owner" || role === "dev") && (
                    <option value="admin">Admin</option>
                  )}
                </select>
              </label>
              
              {error && <p style={styles.error}>{error}</p>}
              
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setError("");
                  }}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedAccount && (
        <div style={styles.modalOverlay} onClick={() => setShowPasswordModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalHeading}>Reset Password</h3>
            <p style={{ opacity: 0.8, marginBottom: "1rem" }}>
              Resetting password for: <strong>{selectedAccount.display_name}</strong>
            </p>
            
            <form onSubmit={handleResetPassword} style={styles.form}>
              <label style={styles.label}>
                New Password *
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  style={styles.input}
                  placeholder="Min 3 characters"
                  autoFocus
                />
              </label>
              
              <label style={styles.label}>
                Confirm Password *
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  style={styles.input}
                  placeholder="Re-enter password"
                />
              </label>
              
              {error && <p style={styles.error}>{error}</p>}
              
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setError("");
                  }}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton}>
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAccount && (
        <div style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...styles.modalHeading, color: "#ef4444" }}>Delete Account</h3>
            <p style={{ marginBottom: "1.5rem" }}>
              Are you sure you want to permanently delete <strong>{selectedAccount.display_name}</strong>?
              This action cannot be undone.
            </p>
            
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                style={styles.dangerButton}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { 
    padding: "1.5rem",
    maxWidth: 1400,
    margin: "0 auto",
  },
  header: {
    marginBottom: "2rem",
  },
  heading: { 
    margin: "0 0 1.5rem 0", 
    fontSize: "1.75rem",
    color: "#e5e7eb",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "1rem",
  },
  statCard: {
    padding: "1rem",
    background: "rgba(15, 22, 36, 0.6)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    textAlign: "center",
  },
  statValue: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "#e5e7eb",
    marginBottom: "0.25rem",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "rgba(148,163,184,0.9)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  controls: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    minWidth: 250,
    padding: "0.6rem 1rem",
    fontSize: "0.95rem",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "#050816",
    color: "#e5e7eb",
  },
  select: {
    padding: "0.6rem 1rem",
    fontSize: "0.95rem",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "#050816",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  createButton: {
    padding: "0.6rem 1.25rem",
    fontSize: "0.95rem",
    background: "#22c55e",
    color: "#020617",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  card: {
    padding: "2rem",
    borderRadius: 12,
    background: "#0f1624",
    boxShadow: "0 0 0 1px rgba(148,163,184,0.25)",
    color: "#e5e7eb",
  },
  tableCard: {
    borderRadius: 12,
    background: "#0f1624",
    boxShadow: "0 0 0 1px rgba(148,163,184,0.25)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "rgba(148,163,184,0.9)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(15, 22, 36, 0.6)",
  },
  tr: {
    borderBottom: "1px solid rgba(148,163,184,0.1)",
  },
  td: {
    padding: "1rem",
    color: "#e5e7eb",
  },
  nameCell: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.9rem",
    color: "#fff",
  },
  badge: {
    padding: "0.25rem 0.75rem",
    borderRadius: 999,
    fontSize: "0.85rem",
    fontWeight: 500,
  },
  statusDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    marginRight: "0.5rem",
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
  },
  actionBtn: {
    padding: "0.35rem 0.6rem",
    fontSize: "1rem",
    background: "transparent",
    border: "1px solid rgba(148,163,184,0.3)",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#0f1624",
    borderRadius: 12,
    padding: "2rem",
    maxWidth: 500,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(148,163,184,0.25)",
  },
  modalHeading: {
    margin: "0 0 1.5rem 0",
    fontSize: "1.35rem",
    color: "#e5e7eb",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontSize: "0.9rem",
    color: "#e5e7eb",
    gap: "0.5rem",
  },
  input: {
    padding: "0.6rem",
    fontSize: "0.95rem",
    borderRadius: 6,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "#050816",
    color: "#e5e7eb",
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1rem",
  },
  primaryButton: {
    flex: 1,
    padding: "0.7rem",
    fontSize: "0.95rem",
    background: "#22c55e",
    color: "#020617",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    flex: 1,
    padding: "0.7rem",
    fontSize: "0.95rem",
    background: "#1f2937",
    color: "#e5e7eb",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  dangerButton: {
    flex: 1,
    padding: "0.7rem",
    fontSize: "0.95rem",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    color: "#f97373",
    fontSize: "0.9rem",
    margin: "0.5rem 0 0 0",
  },
  toast: {
    position: "fixed",
    top: "2rem",
    right: "2rem",
    padding: "1rem 1.5rem",
    borderRadius: 8,
    color: "#fff",
    fontWeight: 500,
    zIndex: 2000,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
    animation: "slideIn 0.3s ease-out",
  },
};
