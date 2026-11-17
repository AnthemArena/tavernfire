"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase";

const NAME_MAX = 40;

function cleanName(raw: string | null | undefined): string {
  const name = (raw ?? "").trim().slice(0, NAME_MAX);
  return name || "Adventurer";
}

/** Create the public profile document the first time someone signs in. */
async function ensureProfile(user: User, displayName?: string) {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    displayName: cleanName(
      displayName ?? user.displayName ?? user.email?.split("@")[0],
    ),
    avatarUrl: user.photoURL ?? null,
    createdAt: serverTimestamp(),
  });
}

type AuthContextValue = {
  user: User | null;
  displayName: string | null;
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped to re-render after the signed-in user's name changes in place.
  const [, setVersion] = useState(0);
  // While an email sign-up is running, it creates the profile itself (with the
  // chosen name), so the auth listener must not create one first.
  const signingUp = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (next) => {
      setUser(next);
      setLoading(false);
      if (next && !signingUp.current) {
        try {
          await ensureProfile(next);
        } catch (err) {
          console.error("Could not create profile", err);
        }
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      signingUp.current = true;
      try {
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          email.trim(),
          password,
        );
        const name = cleanName(displayName);
        await updateProfile(cred.user, { displayName: name });
        await ensureProfile(cred.user, name);
        setVersion((v) => v + 1);
      } finally {
        signingUp.current = false;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      displayName: user
        ? cleanName(user.displayName ?? user.email?.split("@")[0])
        : null,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }),
    // user.displayName can change without the user object changing, so this is
    // recomputed on every provider render (the version bump above triggers one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, user?.displayName, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
