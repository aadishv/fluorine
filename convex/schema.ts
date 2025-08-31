import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  // Fact-checking tables
  factCheckRequests: defineTable({
    userId: v.id("users"),
    url: v.string(),
    result: v.optional(v.string()),
    authenticityScore: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
  }).index("by_user", ["userId"]),

  userDailyLimits: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    requestCount: v.number(),
  }).index("by_user_date", ["userId", "date"]),
});
