import { NextRequest } from "next/server";
import { AppError } from "./api-response";

/**
 * Validates CSRF headers on public state-changing mutations.
 * Allows same-origin and verified host requests; rejects cross-origin attacks.
 */
export function validateCsrf(req: NextRequest): void {
  // Check Sec-Fetch-Site header (modern browsers)
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    throw new AppError("Cross-site request blocked by security policy", 403, "CSRF_FORBIDDEN");
  }

  // Check Origin and Host
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        throw new AppError("Invalid request origin", 403, "CSRF_FORBIDDEN");
      }
    } catch {
      throw new AppError("Malformed request origin", 403, "CSRF_FORBIDDEN");
    }
  }
}
