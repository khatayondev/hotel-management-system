import crypto from "node:crypto";
import { cookies } from "next/headers";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import * as OTPAuth from "otpauth";
import { prisma } from "./db";
import { UserRole, PermissionKey } from "./rbac";
import { normalizeGhanaPhone } from "./sms";
import { logger } from "./logger";

export const SESSION_COOKIE_NAME = "aura_session";

// Session lifecycles
export const SESSION_ABSOLUTE_EXPIRY_HOURS = 24 * 14; // 14 days max lifetime
export const SESSION_IDLE_TIMEOUT_HOURS = 24; // 24 hours idle timeout for salon operational tablets & laptops
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

export interface AuthSession {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  staffId?: string | null;
  mustChangePassword: boolean;
  permissions: PermissionKey[];
}

/**
 * Hash a password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

/**
 * Verify a password using Argon2id.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify(hash, password);
  } catch (err) {
    logger.error("Argon2id verification error", err);
    return false;
  }
}

/**
 * Generates a cryptographically secure hex token.
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hashes a token using SHA-256 for secure database lookup.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a new TOTP secret for Owner 2FA setup.
 */
export function generateTotpSecret(email: string): { secret: string; uri: string } {
  const totp = new OTPAuth.TOTP({
    issuer: "Becca's Crown Beauty Vault",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Validates a TOTP token against a secret.
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "Becca's Crown Beauty Vault",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    // delta window of 1 allows +/- 30 seconds clock drift
    const delta = totp.validate({ token: token.trim(), window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * Write an audit log entry for authentication events.
 */
export async function logAuthEvent(
  action: "AUTH_LOGIN_SUCCESS" | "AUTH_LOGIN_FAILURE" | "AUTH_ACCOUNT_LOCKED" | "AUTH_LOGOUT" | "AUTH_PASSWORD_RESET" | "AUTH_PASSWORD_CHANGE",
  userId: string | null,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: "User",
        entityId: userId,
        newValues: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    logger.error("Failed to write auth audit log", err);
  }
}

export interface AuthenticateUserResult {
  success: boolean;
  requiresTotp?: boolean;
  requiresPasswordChange?: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    mustChangePassword: boolean;
  };
  sessionToken?: string;
  error?: string;
}

/**
 * Authenticates staff with email OR phone and password.
 * Uses generic error messages to prevent user enumeration.
 */
export async function authenticateStaff(
  identifier: string, // Email or Ghana phone (+233 or 024)
  password: string,
  totpCode?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthenticateUserResult> {
  const GENERIC_ERROR = "Invalid credentials. Please verify your details and try again.";
  const cleanId = identifier.trim();

  // Try matching by normalized phone or email
  let user = null;
  if (cleanId.includes("@")) {
    user = await prisma.user.findUnique({
      where: { email: cleanId.toLowerCase() },
      include: { role: true },
    });
  } else {
    try {
      const normalizedPhone = normalizeGhanaPhone(cleanId);
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { staff: { phone: normalizedPhone } },
          ],
        },
        include: { role: true },
      });
    } catch {
      // If phone normalization failed, check email fallback or continue
      user = await prisma.user.findUnique({
        where: { email: cleanId },
        include: { role: true },
      });
    }
  }

  if (!user || !user.active || user.deletedAt) {
    await logAuthEvent("AUTH_LOGIN_FAILURE", null, { identifier: cleanId, reason: "NOT_FOUND" }, ipAddress, userAgent);
    return { success: false, error: GENERIC_ERROR };
  }

  // Check lockout
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
    await logAuthEvent("AUTH_LOGIN_FAILURE", user.id, { reason: "ACCOUNT_LOCKED", minutesLeft }, ipAddress, userAgent);
    return {
      success: false,
      error: `Account is temporarily locked due to repeated failed attempts. Please try again in ${minutesLeft} minute(s).`,
    };
  }

  // Verify password with Argon2id
  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    const updatedAttempts = user.failedLoginAttempts + 1;
    let lockedUntil: Date | null = null;

    if (updatedAttempts >= MAX_LOGIN_ATTEMPTS) {
      lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil,
        },
      });
      await logAuthEvent("AUTH_ACCOUNT_LOCKED", user.id, { lockoutMinutes: LOCKOUT_DURATION_MINUTES }, ipAddress, userAgent);
      return {
        success: false,
        error: `Account has been locked for ${LOCKOUT_DURATION_MINUTES} minutes due to multiple failed login attempts.`,
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: updatedAttempts },
    });

    await logAuthEvent("AUTH_LOGIN_FAILURE", user.id, { failedAttempts: updatedAttempts }, ipAddress, userAgent);
    return { success: false, error: GENERIC_ERROR };
  }

  // Check 2FA (TOTP) if enabled for Owner
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) {
      return {
        success: false,
        requiresTotp: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name as UserRole,
          mustChangePassword: user.mustChangePassword,
        },
      };
    }

    const isTotpValid = verifyTotpToken(totpCode, user.totpSecret);
    if (!isTotpValid) {
      await logAuthEvent("AUTH_LOGIN_FAILURE", user.id, { reason: "INVALID_TOTP" }, ipAddress, userAgent);
      return { success: false, error: "Invalid two-factor authentication code." };
    }
  }

  // Reset failed login attempts on success
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const { rawToken } = await createSession(user.id, ipAddress, userAgent);

  await logAuthEvent("AUTH_LOGIN_SUCCESS", user.id, { role: user.role.name }, ipAddress, userAgent);

  return {
    success: true,
    requiresPasswordChange: user.mustChangePassword,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name as UserRole,
      mustChangePassword: user.mustChangePassword,
    },
    sessionToken: rawToken,
  };
}

/**
 * Create a new database-backed session for a user.
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ rawToken: string; expiresAt: Date }> {
  const now = new Date();
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      lastActiveAt: now,
      ipAddress,
      userAgent,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Validate a session token against database.
 * Enforces absolute expiry and sliding idle timeout.
 */
export async function validateSessionToken(token: string): Promise<AuthSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = new Date();

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
          staff: true,
        },
      },
    },
  });

  if (!session || !session.user || !session.user.active || session.user.deletedAt) {
    return null;
  }

  // Check absolute expiry
  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check idle timeout (e.g., 2 hours since lastActiveAt)
  const idleExpiration = new Date(session.lastActiveAt.getTime() + SESSION_IDLE_TIMEOUT_HOURS * 60 * 60 * 1000);
  if (idleExpiration <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Slide lastActiveAt forward on valid activity
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: now },
  }).catch(() => {});

  const permissions = session.user.role.rolePermissions.map(
    (rp) => rp.permission.name as PermissionKey
  );

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role.name as UserRole,
    staffId: session.user.staff?.id ?? null,
    mustChangePassword: session.user.mustChangePassword,
    permissions,
  };
}

/**
 * Retrieves the current session from incoming request cookies.
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

/**
 * Invalidate current session and clear cookie.
 */
export async function terminateCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => {});
  }
}

/**
 * Revoke all active sessions for a user (log out of all devices).
 */
export async function terminateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
  await logAuthEvent("AUTH_LOGOUT", userId, { scope: "ALL_DEVICES" });
}

/**
 * Create an admin-initiated password reset token.
 */
export async function createPasswordResetToken(userId: string, expiryHours = 24): Promise<string> {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  // Invalidate any existing unused reset tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Consumes a password reset token and updates the user's password.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  const tokenHash = hashToken(token);
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
    return { success: false, error: "Password reset link is invalid or has expired." };
  }

  const newHash = await hashPassword(newPassword);

  // Update password, clear mustChangePassword, clear lockout, and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate existing sessions on password reset
    prisma.session.deleteMany({
      where: { userId: resetRecord.userId },
    }),
  ]);

  await logAuthEvent("AUTH_PASSWORD_RESET", resetRecord.userId);
  return { success: true };
}
