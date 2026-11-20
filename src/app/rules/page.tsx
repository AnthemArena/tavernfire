import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Community rules – Tavernfire" };

export default function RulesPage() {
  return (
    <LegalPage title="Community rules">
      <p>
        Tavernfire is for things made by people, for people who play tabletop games. These
        are the rules that keep it that way.
      </p>

      <h2>Write it yourself</h2>
      <ul>
        <li>Submit only your own work.</li>
        <li>
          Fine: proofreading, spell-checking, and using books or other reference material
          for inspiration (credit it where it makes sense).
        </li>
        <li>
          Not fine: asking an AI to write or substantially rewrite your answer, or pasting
          in someone else&apos;s work.
        </li>
        <li>
          We can&apos;t reliably detect AI text, so this is a shared standard rather than a
          guarantee. We rely on honesty and on reports.
        </li>
      </ul>

      <h2>Be decent</h2>
      <ul>
        <li>No harassment, hate, threats or content that targets a person.</li>
        <li>No spam, adverts or off-topic posts.</li>
        <li>No sexual content involving children, ever.</li>
        <li>Keep answers about the game: a character, place, item or creature.</li>
      </ul>

      <h2>Reporting</h2>
      <p>
        Use <strong>Report answer</strong> on any answer that breaks these rules (AI-generated,
        copied, spam or abuse). Reports go to a private review. A report never penalises
        anyone automatically; a person looks at it first.
      </p>

      <h2>What happens if rules are broken</h2>
      <p>
        We may hide or remove content, and repeat or serious breaches can lead to an account
        being closed. If you think we got it wrong, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&apos;ll look again.
      </p>

      <p>
        More about how answers can be used is in the <Link href="/terms">terms</Link>.
      </p>
    </LegalPage>
  );
}
