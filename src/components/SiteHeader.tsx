"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Reads the route, so it sits in its own Suspense boundary. */
function MainNav() {
  const pathname = usePathname();
  const onRequests =
    pathname === "/" || pathname.startsWith("/fires");
  return (
    <nav className="nav" aria-label="Main">
      <Link
        href="/"
        className={onRequests ? "nav-current" : undefined}
        aria-current={onRequests ? "page" : undefined}
      >
        Fires
      </Link>
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

/** The signed-in person's circle: name, account and sign out in one small menu. */
function AvatarMenu() {
  const { user, displayName, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : null;

  return (
    <div className="avatar-menu" ref={box}>
      <button
        type="button"
        className="avatar-button"
        aria-label="Your menu"
        aria-expanded={open}
        aria-controls="avatar-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {initial ?? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
          </svg>
        )}
      </button>
      {open && (
        <div className="avatar-panel" id="avatar-panel">
          <p className="avatar-name">{displayName ?? "No name yet"}</p>
          {user && displayName && (
            <Link href={`/profile/${user.uid}`} className="avatar-item" onClick={() => setOpen(false)}>
              View profile
            </Link>
          )}
          <Link href="/account" className="avatar-item" onClick={() => setOpen(false)}>
            Your account
          </Link>
          <button
            type="button"
            className="avatar-item"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function SiteHeader() {
  const { user, loading } = useAuth();

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
            <AvatarMenu />
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
