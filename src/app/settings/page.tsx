import type { Metadata } from "next";
import SettingsView from "@/components/SettingsView";

export const metadata: Metadata = {
  title: "Settings – Tavernfire",
};

export default function SettingsPage() {
  return (
    <main className="container narrow">
      <SettingsView />
    </main>
  );
}
