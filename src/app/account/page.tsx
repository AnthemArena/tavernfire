import type { Metadata } from "next";
import AccountView from "@/components/AccountView";

export const metadata: Metadata = {
  title: "Your account – Tavernfire",
};

export default function AccountPage() {
  return (
    <main className="container narrow">
      <AccountView />
    </main>
  );
}
