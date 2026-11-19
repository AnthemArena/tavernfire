"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase";
import { EMPTY_PROFILE, claimName, loadProfile, type Profile } from "@/lib/display-name";

/**
 * Create the public profile document the first time someone signs in. It holds
 * no name: people choose one when they first post a request. Nothing from the
 * Google account (name, photo) is copied across.
 */
async function ensureProfile(user: User) {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, { displayName: null, createdAt: serverTimestamp() });
}

type AuthContextValue = {
  user: User | null;
  /** The public name the person chose, or null until they choose one. */
  displayName: string | null;
  /** Reserve and save a public name. Throws a NameError with a message to show. */
  chooseName: (name: string) => Promise<string>;
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (next) => {
      setUser(next);
      setLoading(false);
      if (!next) {
        setProfile(EMPTY_PROFILE);
        return;
      }
      try {
        await ensureProfile(next);
        setProfile(await loadProfile(next.uid));
      } catch (err) {
        console.error("Could not load profile", err);
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

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const chooseName = useCallback(
    async (name: string) => {
      if (!user) throw new Error("Not signed in");
      const next = await claimName(user.uid, name, profile);
      setProfile(next);
      return next.displayName ?? name;
    },
    [user, profile],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      displayName: profile.displayName,
      chooseName,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOut,
    }),
    [user, profile.displayName, chooseName, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
