import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy – Tavernfire" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated={LEGAL_UPDATED}>
      <p>
        This page explains what Tavernfire keeps about you and why. We collect as little as we
        can.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address and sign-in details (a password, or
          Google sign-in). If you sign in with Google, we receive your email address from
          Google; your Google name is not shown on the site.
        </li>
        <li>
          <strong>Your display name:</strong> the name you choose. It is public.
        </li>
        <li>
          <strong>What you post:</strong> fires you light and answers you write, with when you
          posted them. These are public and carry your display name.
        </li>
        <li>
          <strong>Your votes:</strong> which answers you upvoted and which fires you stoked.
          Only you can see these lists. Others see only totals.
        </li>
        <li>
          <strong>Reports:</strong> if you report an answer, we keep the report so a moderator
          can review it.
        </li>
      </ul>

      <h2>What is public</h2>
      <p>
        Your display name, profile page (when you joined, your fires and answers, and how many
        upvotes you received), and everything you post. Your email address is never shown.
      </p>

      <h2>Why we use it</h2>
      <p>
        To run the site: sign you in, show your posts, count votes, send account emails
        (verification and password reset), and moderate reports. We don&apos;t sell your data
        and we don&apos;t show adverts.
      </p>

      <h2>Where it lives</h2>
      <p>
        Tavernfire runs on Google Firebase. Data is stored in Google&apos;s data centres in
        London and the Netherlands, and Google processes it for us under its own terms.
      </p>

      <h2>Cookies and storage</h2>
      <p>
        We use only what is needed to keep you signed in and to remember your light or dark
        theme choice. We don&apos;t use advertising or tracking cookies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can change your display name from your settings page.</li>
        <li>You can delete your own answers while you are signed in.</li>
        <li>
          To delete your account and the data we hold, or to ask what we hold about you, write
          to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>
      <p>
        Content licensed to others under the <Link href="/terms">terms</Link> before you
        deleted it stays licensed to them.
      </p>

      <h2>Changes</h2>
      <p>We will update the date above if this page changes.</p>
    </LegalPage>
  );
}
