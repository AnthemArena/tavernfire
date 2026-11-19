import type { Metadata } from "next";
import { Suspense } from "react";
import ProfileView from "@/components/ProfileView";

export const metadata: Metadata = {
  title: "Profile – Tavernfire",
};

export default function ProfilePage(props: PageProps<"/profile/[uid]">) {
  return (
    <main className="container">
      <Suspense fallback={<p className="muted page-note">Loading…</p>}>
        <ProfileLoader params={props.params} />
      </Suspense>
    </main>
  );
}

async function ProfileLoader({ params }: { params: PageProps<"/profile/[uid]">["params"] }) {
  const { uid } = await params;
  return <ProfileView uid={uid} />;
}
