import Sidebar from "./Sidebar";

export default function AppShell({
  activeTab,
  onTabChange,
  role,
  onLogout,
  children,
}) {
  return (
    <div className="shell-root">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        role={role}
        onLogout={onLogout}
      />

      <main className="shell-main">{children}</main>
    </div>
  );
}
