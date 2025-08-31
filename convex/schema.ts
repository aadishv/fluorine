import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";




export default defineSchema({
  ...authTables,

  factCheckRequests: defineTable({
    userId: v.id("users"),
    url: v.string(),
    result: v.optional(v.string()),
    // DEPRECATED
    authenticityScore: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
  }).index("by_user", ["userId"]),

  userDailyLimits: defineTable({
    userId: v.id("users"),
    date: v.string(),
    requestCount: v.number(),
  }).index("by_user_date", ["userId", "date"]),
});
