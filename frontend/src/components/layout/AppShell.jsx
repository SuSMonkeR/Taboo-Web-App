import Sidebar from "./Sidebar";

export default function AppShell({ activeTab, onTabChange, children }) {
  return (
    <div className="shell-root">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

      <main className="shell-main">
        {children}
      </main>
    </div>
  );
}
