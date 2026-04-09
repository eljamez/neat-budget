# Convex Auth Pattern (Stabilization Note)

This project now uses a migration-safe auth pattern for Convex handlers:

- **Source of truth:** Convex auth identity (`ctx.auth.getUserIdentity()`)
- **Compatibility fallback:** optional `args.userId` during transition
- **Mismatch protection:** reject when auth identity and provided `userId` differ

Implemented via:

- `convex/authUser.ts` -> `getEffectiveUserId(ctx, providedUserId?)`

## Required Pattern For New/Updated Handlers

1. Accept optional user arg where needed:

- `userId: v.optional(v.string())`

2. Resolve effective user at start of handler:

- `const userId = await getEffectiveUserId(ctx, args.userId)`

3. Use resolved `userId` for all:

- ownership checks (`doc.userId === userId`)
- user-scoped reads (`withIndex("by_user"... userId)`)
- inserts/patches (`userId` field writes)

4. Never trust raw `args.userId` directly after resolution.

## Example

```ts
export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    return await ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
```

## Performance + Auth Together

For month-scoped transaction reads:

- prefer indexed date ranges (`by_user_date`) with:
  - `start = YYYY-MM-01`
  - `endExclusive = nextMonth-01`
  - use `.gte(start).lt(endExclusive)`
- then apply narrow secondary filters only when no composite index exists.

## Migration Status

- Handler-level required `userId` validators have been migrated to optional + auth helper.
- `convex/schema.ts` still correctly uses required `userId` as a stored field type (this is expected).

## Future Cleanup (optional)

- Once all clients are confirmed auth-context based, remove fallback behavior and require auth identity only.
