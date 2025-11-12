import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CLIENT_ID !== "your-google-client-id"
      ),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL!, "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session.session & {
  user: typeof auth.$Infer.Session.user;
};
export type User = typeof auth.$Infer.Session.user;

// Extended User type with custom fields
export interface ExtendedUser extends User {
  role?: string;
  isActive?: boolean;
}

// Database User type that matches Prisma schema
export interface DatabaseUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
}

// Role-based access control helper functions
export const hasRole = (user: ExtendedUser | null, role: string): boolean => {
  if (!user || !user.role) return false;
  return user.role === role;
};

export const hasAnyRole = (
  user: ExtendedUser | null,
  roles: string[]
): boolean => {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};

export const isAdmin = (user: ExtendedUser | null): boolean => {
  return hasRole(user, "ADMIN");
};

export const isEditor = (user: ExtendedUser | null): boolean => {
  return hasAnyRole(user, ["ADMIN", "EDITOR"]);
};

export const isViewer = (user: ExtendedUser | null): boolean => {
  return hasAnyRole(user, ["ADMIN", "EDITOR", "VIEWER"]);
};

// Middleware for role-based route protection
export const requireRole = (requiredRole: string) => {
  return (user: ExtendedUser | null) => {
    if (!user) throw new Error("Authentication required");
    if (!hasRole(user, requiredRole))
      throw new Error("Insufficient permissions");
    return true;
  };
};

export const requireAnyRole = (requiredRoles: string[]) => {
  return (user: ExtendedUser | null) => {
    if (!user) throw new Error("Authentication required");
    if (!hasAnyRole(user, requiredRoles))
      throw new Error("Insufficient permissions");
    return true;
  };
};

// Helper function to get user with role from database
export async function getUserWithRole(
  userId: string
): Promise<DatabaseUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        emailVerified: true,
      },
    });
    return user;
  } catch (error) {
    console.error("Error fetching user with role:", error);
    return null;
  }
}

// Helper function to check role from database user
export const hasRoleFromDb = (
  user: DatabaseUser | null,
  role: string
): boolean => {
  if (!user) return false;
  return user.role === role;
};

export const hasAnyRoleFromDb = (
  user: DatabaseUser | null,
  roles: string[]
): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};
