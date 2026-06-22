const ROLE_ORDER = {
  STAFF: 1,
  MANAGER: 2,
  OWNER: 3,
} as const;

export type UserRole = keyof typeof ROLE_ORDER;

export function getRoleFromRequest(request: Request): UserRole {
  const roleHeader = request.headers.get("x-user-role")?.toUpperCase();
  if (roleHeader === "OWNER" || roleHeader === "MANAGER" || roleHeader === "STAFF") {
    return roleHeader;
  }

  // Default to manager during bootstrap; replace with real auth claims in next phase.
  return "MANAGER";
}

export function hasMinimumRole(current: UserRole, required: UserRole): boolean {
  return ROLE_ORDER[current] >= ROLE_ORDER[required];
}

export function requireMinimumRole(request: Request, required: UserRole): Response | null {
  const role = getRoleFromRequest(request);
  if (hasMinimumRole(role, required)) {
    return null;
  }

  return Response.json(
    {
      error: `Insufficient role. Required: ${required}`,
      currentRole: role,
    },
    { status: 403 },
  );
}
