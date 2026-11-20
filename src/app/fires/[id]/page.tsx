import type { Metadata } from "next";
import { Suspense } from "react";
import RequestView from "@/components/RequestView";

export const metadata: Metadata = {
  title: "Fire – Tavernfire",
};

export default function RequestPage(props: PageProps<"/fires/[id]">) {
  return (
    <main className="container">
      <Suspense fallback={<p className="muted page-note">Loading…</p>}>
        <RequestLoader params={props.params} />
      </Suspense>
    </main>
  );
}

async function RequestLoader({
  params,
}: {
  params: PageProps<"/fires/[id]">["params"];
}) {
  const { id } = await params;
  return <RequestView id={id} />;
}
