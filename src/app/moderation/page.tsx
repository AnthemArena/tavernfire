import type { Metadata } from "next";
import ModerationView from "@/components/ModerationView";

export const metadata: Metadata = {
  title: "Moderation – Tavernfire",
  robots: { index: false },
};

export default function ModerationPage() {
  return (
    <main className="container narrow">
      <ModerationView />
    </main>
  );
}
