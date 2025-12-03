import { useState } from "react";
import AppShell from "./layout/AppShell";
import PlayView from "./play/PlayView";
import ManageView from "./manage/ManageView";

export default function MainApp() {
  const [activeTab, setActiveTab] = useState("play"); // "play" | "manage"

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "play" ? <PlayView /> : <ManageView />}
    </AppShell>
  );
}
