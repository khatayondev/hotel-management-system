/**
 * Structured logger with automated PII minimisation, log redaction, and error reporting.
 * Prevents passwords, tokens, API keys, card details, and raw phone numbers from leaking into logs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "secret",
  "secretkey",
  "secret_key",
  "token",
  "tokenhash",
  "managetokenhash",
  "authorization",
  "cookie",
  "cvv",
  "pan",
  "cardnumber",
  "accountnumber",
  "otp",
  "pin",
  "privatekey",
  "apikey",
  "paystacksecretkey",
  "idnumber",
  "id_number",
  "nationalid",
  "passport",
  "passportnumber",
]);

/**
 * Masks an ID/Passport number string to prevent raw PII leakage:
 * e.g. "GHA-712345678-9" -> "GHA-****-9"
 */
export function maskIdNumber(idNumber: string): string {
  if (!idNumber || idNumber.length < 5) return "***";
  const start = idNumber.slice(0, 4);
  const end = idNumber.slice(-2);
  return `${start}****${end}`;
}

/**
 * Masks a telephone string to prevent raw PII leakage:
 * e.g. "+233241112233" -> "+23324****233"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return "***";
  const start = phone.slice(0, 6);
  const end = phone.slice(-3);
  return `${start}****${end}`;
}

/**
 * Recursively redacts sensitive values and masks phone numbers.
 */
export function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    // Check if string looks like an E.164 phone number
    if (/^\+233\d{9}$/.test(data)) {
      return maskPhoneNumber(data);
    }
    // Check if string looks like a JWT or Bearer token
    if (data.startsWith("Bearer ") || (data.length > 60 && /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/.test(data))) {
      return "[REDACTED_TOKEN]";
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, "");
      if (SENSITIVE_KEYS.has(lowerKey)) {
        redacted[key] = "[REDACTED]";
      } else if (lowerKey === "phone" && typeof value === "string") {
        redacted[key] = maskPhoneNumber(value);
      } else {
        redacted[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return redacted;
  }

  return data;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, err?: unknown): string {
    const sanitizedContext = context ? (redactSensitiveData(context) as Record<string, unknown>) : undefined;

    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: sanitizedContext,
    };

    if (err instanceof Error) {
      payload.error = {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      };
    } else if (err) {
      payload.error = {
        message: String(err),
      };
    }

    return JSON.stringify(payload);
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatLog("debug", message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    console.info(this.formatLog("info", message, context));
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(this.formatLog("warn", message, context));
  }

  error(message: string, err?: unknown, context?: Record<string, unknown>) {
    console.error(this.formatLog("error", message, context, err));
  }
}

export const logger = new Logger();
