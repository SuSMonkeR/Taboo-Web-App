import { useState } from "react";
import AppShell from "./layout/AppShell";
import PlayView from "./play/PlayView";
import ManageView from "./manage/ManageView";
import PasswordManagerTab from "./PasswordManagerTab";

export default function MainApp({ role, token, onLogout }) {
  const [activeTab, setActiveTab] = useState("play"); // "play" | "manage" | "password-manager"

  const isAdminLike = role === "admin" || role === "dev";

  const handleTabChange = (tab) => {
    // Staff are not allowed to use non-play tabs
    if (!isAdminLike && tab !== "play") {
      setActiveTab("play");
      return;
    }
    setActiveTab(tab);
  };

  let content = null;
  if (activeTab === "play") {
    content = <PlayView />;
  } else if (activeTab === "manage") {
    content = <ManageView />;
  } else if (activeTab === "password-manager") {
    // pass role + token down so the tab can authorize + call APIs
    content = <PasswordManagerTab role={role} token={token} />;
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      role={role}
      onLogout={onLogout}
    >
      {content}
    </AppShell>
  );
}
