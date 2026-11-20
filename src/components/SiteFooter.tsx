import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <span>Tavernfire. Written by people.</span>
        <nav className="footer-links" aria-label="Site information">
          <Link href="/rules">Rules</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <ThemeToggle />
      </div>
    </footer>
  );
}
