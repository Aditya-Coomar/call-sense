import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
});

export const { useSession, signIn, signUp, signOut } = authClient;

// Custom hook to get user from session
export const useUser = () => {
  const { data: session } = useSession();
  return session?.user ?? null;
};
