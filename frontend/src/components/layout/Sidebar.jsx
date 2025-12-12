export default function Sidebar({ activeTab, onTabChange, role, onLogout }) {
  const isAdminLike = role === "admin" || role === "dev";

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

      {/* Simple footer: role label + logout */}
      <div
        style={{
          marginTop: "auto",
          padding: "1rem",
          fontSize: "0.8rem",
        }}
      >
        <div style={{ opacity: 0.7, marginBottom: "0.5rem" }}>
          Role: <b>{role}</b>
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
