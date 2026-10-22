"use client";

import { useContext } from "react";
import { SessionContext, type SessionValue } from "@/providers/SessionProvider";

/** `{ user, status, signIn, signUp, signInWithGoogle, completeGoogleSignUp, signInAsDemo, signOut }` da sessão simulada. */
export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  return session;
}
