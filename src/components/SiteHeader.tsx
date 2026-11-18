"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SiteHeader() {
  const { user, displayName, loading, signOut } = useAuth();
  const pathname = usePathname();
  const onRequests = pathname === "/" || pathname.startsWith("/requests");
  const onSignIn = pathname === "/signin";

  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" href="/">
          Tavernfire
        </Link>

        <nav className="nav" aria-label="Main">
          <Link
            href="/"
            className={onRequests ? "nav-current" : undefined}
            aria-current={onRequests ? "page" : undefined}
          >
            Requests
          </Link>
        </nav>

        <div className="header-actions">
          {loading ? null : user ? (
            <>
              <span className="signed-in-as">{displayName}</span>
              <button type="button" className="btn btn-outline" onClick={() => signOut()}>
                Sign out
              </button>
            </>
          ) : onSignIn ? null : (
            <Link className="btn btn-dark" href="/signin">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
