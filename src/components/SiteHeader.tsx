"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function SiteHeader() {
  const { user, displayName, loading, signOut } = useAuth();

  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" href="/">
          Tavernfire
        </Link>

        <nav className="nav" aria-label="Main">
          <Link href="/" className="nav-current" aria-current="page">
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
          ) : (
            <Link className="btn btn-dark" href="/signin">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
