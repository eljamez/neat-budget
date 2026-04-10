import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Resolve effective app user id from Convex auth context first, while allowing
 * legacy caller-provided ids during migration.
 */
export async function getEffectiveUserId(
  ctx: AuthCtx,
  providedUserId?: string
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  const identityUserId = extractIdentityUserId(identity);

  if (identityUserId && providedUserId && identityUserId !== providedUserId) {
    throw new Error("Authenticated user does not match requested userId");
  }

  if (identityUserId) {
    return identityUserId;
  }
  if (providedUserId) {
    return providedUserId;
  }
  throw new Error("Not authenticated");
}

function extractIdentityUserId(
  identity: Awaited<ReturnType<AuthCtx["auth"]["getUserIdentity"]>>
): string | null {
  if (!identity) return null;
  if (typeof identity.subject === "string" && identity.subject.length > 0) {
    return identity.subject;
  }
  if (
    typeof identity.tokenIdentifier === "string" &&
    identity.tokenIdentifier.length > 0
  ) {
    const parts = identity.tokenIdentifier.split("|");
    return parts[parts.length - 1] || null;
  }
  return null;
}
