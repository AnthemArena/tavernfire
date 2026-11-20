import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT_EMAIL, LEGAL_UPDATED, LICENCE_NAME, LICENCE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms – Tavernfire" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated={LEGAL_UPDATED}>
      <p>
        These are the terms for using Tavernfire. We&apos;ve tried to keep them short and
        plain. By creating an account or posting, you agree to them and to the{" "}
        <Link href="/rules">community rules</Link>.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You need a verified email address to post, answer, upvote or stoke.</li>
        <li>You are responsible for what happens under your account. Keep your password safe.</li>
        <li>Your display name, your answers and the fires you light are public.</li>
      </ul>

      <h2>Your work and how it can be used</h2>
      <p>
        You keep ownership of everything you write on Tavernfire. By posting it, you confirm
        it is your own work and you license it to everyone under{" "}
        <a href={LICENCE_URL} target="_blank" rel="noreferrer">
          {LICENCE_NAME}
        </a>
        .
      </p>
      <p>In plain words:</p>
      <ul>
        <li>
          Anyone can use your answer at their table, in their own games, books or modules,
          including ones they sell.
        </li>
        <li>
          If they share or publish it, they should credit you by the name shown on your
          answer. Using it at your own table needs no credit.
        </li>
        <li>
          The licence cannot be taken back for people who already used your work under it.
          To have your answer removed from this site, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. That stops new uses from
          this site, but copies already made stay licensed.
        </li>
      </ul>
      <p>
        This applies to answers and to the three sparks and note on fires you light. You also
        give Tavernfire permission to store and show your content on the site, including in the
        Library and search results.
      </p>
      <p>
        If your answer includes material from someone else (for example a game system&apos;s
        open content), you must have the right to share it and say where it came from.
      </p>

      <h2>Using the site</h2>
      <ul>
        <li>Follow the community rules.</li>
        <li>Don&apos;t try to break, overload or get around the site, or to vote more than once per answer or fire.</li>
        <li>Don&apos;t post anything illegal.</li>
        <li>
          Don&apos;t bulk-copy (scrape) Tavernfire without asking us first. This is a rule
          for using the site. It is separate from the licence on individual answers, and we
          can&apos;t control what people do with copies made under that licence.
        </li>
      </ul>

      <h2>Moderation</h2>
      <p>
        We can hide or remove content and close accounts that break the rules or the law. We
        aim to review reports fairly and will reconsider if you write to us.
      </p>

      <h2>No guarantees</h2>
      <p>
        Tavernfire is provided as it is. Answers are written by community members and we
        don&apos;t check them. We don&apos;t promise the site will always be available, and
        to the extent the law allows we are not liable for losses from using it.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will change the date above when we do. Questions: write
        to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
