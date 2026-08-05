"use client";

import { createContext, useContext } from "react";
import { redirect } from "next/navigation";

type Role = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

const RoleContext = createContext<Role | null>(null);

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role {
  const role = useContext(RoleContext);
  if (!role) throw new Error("useRole must be used inside a RoleProvider");
  return role;
}

export function isAdmin(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export function isAgentOrAbove(role: Role) {
  return role === "OWNER" || role === "ADMIN" || role === "AGENT";
}

export function AdminGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  if (!isAdmin(role)) redirect("/dashboard");
  return <>{children}</>;
}

export function RoleAwareAdminGuard({ children }: { children: React.ReactNode }) {
  const role = useRole();
  if (!isAdmin(role)) redirect("/dashboard");
  return <>{children}</>;
}

export function RoleAwareAgentGuard({ children }: { children: React.ReactNode }) {
  const role = useRole();
  if (!isAgentOrAbove(role)) redirect("/dashboard");
  return <>{children}</>;
}
