import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "aura_session";

/**
 * OWASP Content Security Policy directives
 */
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://images.unsplash.com https://api.paystack.co",
  "connect-src 'self' https://api.paystack.co https://checkout.paystack.com https://*.sentry.io",
  "frame-src 'self' https://checkout.paystack.com https://js.paystack.co",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Standard Security Headers
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP_HEADER);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self 'https://checkout.paystack.com')"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const host = request.headers.get("host") || request.nextUrl.host || request.nextUrl.hostname || "";
  const isDashboardSubdomain = host.startsWith("dashboard.");

  // 0. Dashboard subdomain handling for staff login & dashboard
  if (isDashboardSubdomain) {
    if (pathname === "/") {
      const targetUrl = new URL(sessionCookie ? "/dashboard" : "/login", request.url);
      return applySecurityHeaders(NextResponse.redirect(targetUrl));
    }
    if (pathname === "/login" && sessionCookie) {
      const targetUrl = new URL("/dashboard", request.url);
      return applySecurityHeaders(NextResponse.redirect(targetUrl));
    }
  }

  // 1. CSRF Protection for state-changing requests
  const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (mutatingMethods.includes(request.method) && pathname.startsWith("/api/")) {
    // Exempt webhooks from CSRF checks (they use cryptographic HMAC signatures)
    const isWebhook = pathname.startsWith("/api/webhooks");

    if (!isWebhook) {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");

      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          // In production or local, origin host must match request host
          if (originHost !== host) {
            return applySecurityHeaders(
              NextResponse.json(
                {
                  success: false,
                  error: {
                    code: "FORBIDDEN_CSRF",
                    message: "Cross-site request forgery protection blocked this request.",
                  },
                },
                { status: 403 }
              )
            );
          }
        } catch {
          // Invalid origin header format
          return applySecurityHeaders(
            NextResponse.json(
              {
                success: false,
                error: {
                  code: "FORBIDDEN_CSRF",
                  message: "Invalid Origin header.",
                },
              },
              { status: 403 }
            )
          );
        }
      }
    }
  }

  // 2. Protect /api/admin/*
  if (pathname.startsWith("/api/admin")) {
    if (!sessionCookie) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required to access admin API",
            },
          },
          { status: 401 }
        )
      );
    }
  }

  // 3. Protect admin dashboard pages
  const protectedPrefixes = [
    "/dashboard",
    "/services",
    "/settings",
    "/appointments",
    "/pos",
    "/staff",
    "/reports",
    "/audit",
    "/customers",
  ];
  const isProtectedPath = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedPath) {
    if (!sessionCookie) {
      const redirectUrl = new URL("/login", request.url);
      const target = pathname + (search || "");
      if (target !== "/dashboard") {
        redirectUrl.searchParams.set("redirect", target);
      }
      return applySecurityHeaders(NextResponse.redirect(redirectUrl));
    }
  }

  // 4. Default: pass through with security headers attached
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public asset files)
     * - icons/ (PWA icon files)
     * - sw.js, manifest.webmanifest, offline.html (PWA offline files)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|icons/|sw.js|manifest.webmanifest|offline.html).*)",
  ],
};
