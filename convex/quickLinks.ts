import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";

const SUGGESTED_LINKS: Array<{ label: string; url: string }> = [
  { label: "Chase", url: "https://www.chase.com" },
  { label: "USAA", url: "https://www.usaa.com" },
  { label: "IRS", url: "https://www.irs.gov" },
  { label: "Annual Credit Report", url: "https://www.annualcreditreport.com" },
  { label: "Credit Karma", url: "https://www.creditkarma.com" },
  { label: "Social Security", url: "https://www.ssa.gov" },
];

export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const rows = await ctx.db
      .query("quickLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    label: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const existing = await ctx.db
      .query("quickLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((r) => r.sortOrder)) + 1;
    return await ctx.db.insert("quickLinks", {
      userId,
      label: args.label.trim(),
      url: args.url.trim(),
      sortOrder: nextOrder,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("quickLinks"),
    userId: v.optional(v.string()),
    label: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Link not found");
    }
    const patch: {
      label?: string;
      url?: string;
      ogImageUrl?: undefined;
      ogFetchedAt?: undefined;
    } = {};
    if (args.label !== undefined) patch.label = args.label.trim();
    if (args.url !== undefined) {
      const trimmed = args.url.trim();
      patch.url = trimmed;
      if (trimmed !== doc.url) {
        patch.ogImageUrl = undefined;
        patch.ogFetchedAt = undefined;
      }
    }
    await ctx.db.patch(args.id, patch);
  },
});

/** Persists Open Graph image (if any) after the client calls the link-preview API. */
export const setOgPreviewResult = mutation({
  args: {
    id: v.id("quickLinks"),
    userId: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Link not found");
    }
    await ctx.db.patch(args.id, {
      ...(args.ogImageUrl ? { ogImageUrl: args.ogImageUrl } : {}),
      ogFetchedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("quickLinks"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Link not found");
    }
    await ctx.db.delete(args.id);
  },
});

/** Adds suggested bank and financial URLs that this user does not already have. */
export const addSuggested = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const existing = await ctx.db
      .query("quickLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const urls = new Set(existing.map((e) => e.url.toLowerCase()));
    const orderBase =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((r) => r.sortOrder)) + 1;
    let added = 0;
    for (const item of SUGGESTED_LINKS) {
      if (urls.has(item.url.toLowerCase())) continue;
      await ctx.db.insert("quickLinks", {
        userId,
        label: item.label,
        url: item.url,
        sortOrder: orderBase + added,
      });
      urls.add(item.url.toLowerCase());
      added += 1;
    }
    return added;
  },
});
