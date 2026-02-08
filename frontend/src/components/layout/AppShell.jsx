import Sidebar from "./Sidebar";

export default function AppShell({
  activeTab,
  onTabChange,
  role,
  displayName,
  onLogout,
  children,
}) {
  return (
    <div className="shell-root">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        role={role}
        displayName={displayName}
        onLogout={onLogout}
      />

      <main className="shell-main">{children}</main>
    </div>
  );
}