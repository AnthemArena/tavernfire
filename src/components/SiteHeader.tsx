"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Reads the route, so it sits in its own Suspense boundary. */
function MainNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const onAccount = pathname === "/account";
  const onRequests =
    pathname === "/" || pathname.startsWith("/requests") || pathname.startsWith("/fires");
  return (
    <nav className="nav" aria-label="Main">
      <Link
        href="/"
        className={onRequests ? "nav-current" : undefined}
        aria-current={onRequests ? "page" : undefined}
      >
        Fires
      </Link>
      {user && (
        <Link
          href="/account"
          className={onAccount ? "nav-current" : undefined}
          aria-current={onAccount ? "page" : undefined}
        >
          Account
        </Link>
      )}
    </nav>
  );
}

function SignInButton() {
  const pathname = usePathname();
  if (pathname === "/signin") return null;
  return (
    <Link className="btn btn-dark" href="/signin">
      Sign in
    </Link>
  );
}

export default function SiteHeader() {
  const { user, displayName, loading, signOut } = useAuth();

  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" href="/">
          Tavernfire
        </Link>

        <Suspense
          fallback={
            <nav className="nav" aria-label="Main">
              <Link href="/">Fires</Link>
            </nav>
          }
        >
          <MainNav />
        </Suspense>

        <div className="header-actions">
          <Link className="btn btn-primary header-cta" href="/fires/new">
            Light a fire
          </Link>
          {loading ? null : user ? (
            <>
              <span className="signed-in-as">{displayName ?? "Signed in"}</span>
              <button type="button" className="btn btn-outline header-signout" onClick={() => signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <Suspense fallback={null}>
              <SignInButton />
            </Suspense>
          )}
        </div>
      </div>
    </header>
  );
}
