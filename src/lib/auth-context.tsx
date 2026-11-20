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
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase";
import { nextNameChange } from "@/lib/names";
import { EMPTY_PROFILE, claimName, loadProfile, saveAvatar, saveBio, type Profile } from "@/lib/display-name";
import type { AvatarId } from "@/lib/avatars";

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
  /** True once the person's email address is verified (Google sign-ins always are). */
  emailVerified: boolean;
  /** Send the verification email again. */
  resendVerification: () => Promise<void>;
  /** Check again whether the email is verified (after the person clicks the link). */
  refreshVerification: () => Promise<boolean>;
  /** The public name the person chose, or null until they choose one. */
  displayName: string | null;
  /** Reserve and save a public name. Throws a NameError with a message to show. */
  chooseName: (name: string) => Promise<string>;
  /** When the name can next be changed, or null if it can be changed now. Call after sign-in, not while prerendering. */
  nameChangeOn: () => Date | null;
  /** The preset avatar the person chose, or null. */
  avatar: AvatarId | null;
  /** When the avatar was last changed (it can be changed once an hour), or null. */
  avatarChangedAt: Date | null;
  /** Save a preset avatar. Throws an AvatarError with a message to show. */
  chooseAvatar: (avatar: AvatarId) => Promise<void>;
  /** The person's "about me" text (empty if none). */
  bio: string;
  /** The person's experience points. */
  xp: number;
  /** Save the "about me" text. Throws a BioError with a message to show. */
  chooseBio: (bio: string) => Promise<void>;
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
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (next) => {
      setUser(next);
      setEmailVerified(next?.emailVerified ?? false);
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
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    // Voting needs a verified email, so ask for it straight away. Not fatal if it fails:
    // the person can resend it from the voting prompt.
    await sendEmailVerification(cred.user).catch((err) =>
      console.error("Could not send verification email", err),
    );
  }, []);

  const resendVerification = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (current) await sendEmailVerification(current);
  }, []);

  const refreshVerification = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) return false;
    await current.reload();
    // The security rules read the verified flag from the sign-in token, so get a fresh one.
    await current.getIdToken(true);
    setEmailVerified(current.emailVerified);
    return current.emailVerified;
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

  const chooseAvatar = useCallback(
    async (avatar: AvatarId) => {
      if (!user) throw new Error("Not signed in");
      setProfile(await saveAvatar(user.uid, avatar, profile));
    },
    [user, profile],
  );

  const chooseBio = useCallback(
    async (bio: string) => {
      if (!user) throw new Error("Not signed in");
      setProfile(await saveBio(user.uid, bio, profile));
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
      emailVerified,
      resendVerification,
      refreshVerification,
      displayName: profile.displayName,
      chooseName,
      nameChangeOn: () => nextNameChange(profile.nameChangedAt, new Date()),
      avatar: profile.avatar,
      avatarChangedAt: profile.avatarChangedAt,
      chooseAvatar,
      bio: profile.bio,
      xp: profile.xp,
      chooseBio,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOut,
    }),
    [user, emailVerified, resendVerification, refreshVerification, profile.displayName, profile.nameChangedAt, profile.avatar, profile.avatarChangedAt, profile.bio, profile.xp, chooseName, chooseAvatar, chooseBio, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
