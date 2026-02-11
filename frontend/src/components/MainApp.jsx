import { useState } from "react";
import AppShell from "./layout/AppShell";
import PlayView from "./play/PlayView";
import ManageView from "./manage/ManageView";
import PasswordManagerTab from "./PasswordManagerTab";
import OwnerTab from "./OwnerTab";

export default function MainApp({ role, token, displayName, onLogout }) {
  const [activeTab, setActiveTab] = useState("play"); // "play" | "manage" | "password-manager" | "owner"

  const isAdminLike = role === "admin" || role === "dev" || role === "owner";
  const canAccessOwnerTab = role === "dev" || role === "owner";

  const handleTabChange = (tab) => {
    // Operators are not allowed to use non-play tabs
    if (!isAdminLike && tab !== "play") {
      setActiveTab("play");
      return;
    }
    
    // ONLY dev and owner can access Owner tab
    if (tab === "owner" && !canAccessOwnerTab) {
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
  } else if (activeTab === "owner") {
    // ONLY dev and owner can see this
    if (canAccessOwnerTab) {
      content = <OwnerTab role={role} token={token} />;
    } else {
      // If somehow admin tries to access, redirect to play
      content = <PlayView />;
    }
  }

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      role={role}
      displayName={displayName}
      onLogout={onLogout}
    >
      {content}
    </AppShell>
  );
}
