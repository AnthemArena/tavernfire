import type { Metadata } from "next";
import AnswersFeed from "@/components/AnswersFeed";

export const metadata: Metadata = {
  title: "Answers – Tavernfire",
};

export default function AnswersPage() {
  return (
    <main className="container narrow library-page">
      <section className="page-intro">
        <h1 className="section-title">Answers</h1>
        <p className="hero-lede">What people have made for other tables.</p>
      </section>
      <AnswersFeed />
    </main>
  );
}
