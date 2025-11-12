import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Define public routes that don't require authentication
const publicRoutes = ["/", "/login", "/signup"];

// Define API routes that should be excluded from auth middleware
const excludedApiRoutes = [
  "/api/auth",
  "/api/webhooks",
  "/api/scheduled-messages",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, images, etc.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public/") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  // Skip middleware for excluded API routes
  if (excludedApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Add security headers to all responses
  const response = NextResponse.next();

  // Security headers for production-grade application
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // Content Security Policy (adjust as needed for your app)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://accounts.google.com https://api.twilio.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // HSTS for production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Check if route requires authentication
  if (publicRoutes.includes(pathname)) {
    return response;
  }

  try {
    // Get session using Better Auth
    const session = getSessionCookie(request);

    // If no session and route requires auth, redirect to login
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (error) {
    console.error("Middleware auth error:", error);

    // If auth check fails, redirect to login for protected routes
    if (!publicRoutes.includes(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication endpoints)
     * - api/webhooks (webhook endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico).*)",
  ],
};
