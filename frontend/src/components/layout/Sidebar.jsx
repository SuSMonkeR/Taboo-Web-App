export default function Sidebar({ activeTab, onTabChange, role, displayName, onLogout }) {
  const isAdminLike = role === "admin" || role === "dev" || role === "owner";

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-dot" />
        <div className="logo-text">
          <div className="logo-title">Taboo Staff</div>
          <div className="logo-sub">
            {isAdminLike ? "Admin tools" : "Play only"}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={
            "sidebar-btn" + (activeTab === "play" ? " sidebar-btn-active" : "")
          }
          onClick={() => onTabChange("play")}
        >
          ▶ Play
        </button>

        {isAdminLike && (
          <button
            className={
              "sidebar-btn" +
              (activeTab === "manage" ? " sidebar-btn-active" : "")
            }
            onClick={() => onTabChange("manage")}
          >
            ⚙ Manage decks
          </button>
        )}

        {isAdminLike && (
          <button
            className={
              "sidebar-btn" +
              (activeTab === "password-manager" ? " sidebar-btn-active" : "")
            }
            onClick={() => onTabChange("password-manager")}
          >
            🔑 Password Manager
          </button>
        )}
      </nav>

      {/* Simple footer: display name, role label + logout */}
      <div
        style={{
          marginTop: "auto",
          padding: "1rem",
          fontSize: "0.8rem",
        }}
      >
        <div style={{ opacity: 0.9, marginBottom: "0.25rem", fontWeight: 500 }}>
          {displayName || "User"}
        </div>
        <div style={{ opacity: 0.6, marginBottom: "0.5rem", fontSize: "0.75rem" }}>
          {role}
        </div>
        <button
          className="sidebar-btn"
          style={{ width: "100%" }}
          onClick={onLogout}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}