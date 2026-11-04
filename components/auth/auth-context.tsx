"use client";

import * as React from "react";
import { UserRole, PermissionKey, ROLES, DEFAULT_ROLE_PERMISSIONS } from "@/lib/rbac";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  staffId?: string | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isFrontDesk: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchUser = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.user) {
          const u = json.data.user;
          // Ensure permissions are populated with defaults if missing
          const rolePermissions =
            u.permissions && u.permissions.length > 0
              ? u.permissions
              : (DEFAULT_ROLE_PERMISSIONS[u.role as UserRole] || []);
          setUser({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            permissions: rolePermissions,
            staffId: u.staffId ?? null,
          });
          setError(null);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
        if (res.status === 401 && typeof window !== "undefined") {
          const path = window.location.pathname;
          const protectedPrefixes = [
            "/dashboard",
            "/bookings",
            "/appointments",
            "/pos",
            "/customers",
            "/staff",
            "/settings",
            "/reports",
            "/audit",
          ];
          const isProtected = protectedPrefixes.some(
            (prefix) => path === prefix || path.startsWith(`${prefix}/`)
          );
          if (isProtected) {
            window.location.href = `/login?redirect=${encodeURIComponent(path)}`;
          }
        }
      }
    } catch (err) {
      setError("Failed to fetch session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const hasPermission = React.useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (user.role === ROLES.OWNER_ADMIN) return true; // Owner has all permissions
      return user.permissions.includes(permission as PermissionKey);
    },
    [user]
  );

  const hasAnyPermission = React.useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      if (user.role === ROLES.OWNER_ADMIN) return true;
      return permissions.some((p) => user.permissions.includes(p as PermissionKey));
    },
    [user]
  );

  const hasRole = React.useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      const roleList = Array.isArray(roles) ? roles : [roles];
      return roleList.includes(user.role);
    },
    [user]
  );

  const isOwner = user?.role === ROLES.OWNER_ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const isStaff = user?.role === ROLES.STAFF_RECEPTIONIST;
  const isFrontDesk = user?.role === ROLES.FRONT_DESK || user?.role === ROLES.STAFF_RECEPTIONIST;

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      hasPermission,
      hasAnyPermission,
      hasRole,
      isOwner,
      isManager,
      isStaff,
      isFrontDesk,
      refreshUser: fetchUser,
    }),
    [user, loading, error, hasPermission, hasAnyPermission, hasRole, isOwner, isManager, isStaff, isFrontDesk, fetchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      loading: false,
      error: null,
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasRole: () => false,
      isOwner: false,
      isManager: false,
      isStaff: false,
      isFrontDesk: false,
      refreshUser: async () => {},
    };
  }
  return context;
}

