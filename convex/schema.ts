import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    monthlyLimit: v.number(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "isArchived"]),

  transactions: defineTable({
    userId: v.string(),
    categoryId: v.id("categories"),
    amount: v.number(),
    description: v.string(),
    date: v.string(), // ISO date string YYYY-MM-DD
    note: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_category", ["categoryId"]),
});
