export default function Sidebar({ activeTab, onTabChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-dot" />
        <div className="logo-text">
          <div className="logo-title">Taboo Staff</div>
          <div className="logo-sub">Admin tools</div>
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
        <button
          className={
            "sidebar-btn" + (activeTab === "manage" ? " sidebar-btn-active" : "")
          }
          onClick={() => onTabChange("manage")}
        >
          ⚙ Manage decks
        </button>
      </nav>
    </aside>
  );
}
