import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

// Check if user has remaining requests for today
export const checkDailyLimit = query({
  args: {},
  returns: v.object({
    remainingRequests: v.number(),
    hasAccess: v.boolean(),
  }),
  handler: async (ctx, _) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { remainingRequests: 0, hasAccess: false };
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyLimit = await ctx.db
      .query("userDailyLimits")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .unique();

    const used = dailyLimit?.requestCount ?? 0;
    const remaining = Math.max(0, 20 - used);

    return {
      remainingRequests: remaining,
      hasAccess: remaining > 0,
    };
  },
});

// Submit a fact-checking request
export const submitFactCheck = mutation({
  args: { url: v.string() },
  returns: v.id("factCheckRequests"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = await ctx.db
      .query("userDailyLimits")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .unique();

    const used = dailyLimit?.requestCount ?? 0;
    if (used >= 20) {
      throw new Error("Daily limit of 20 requests exceeded");
    }

    // Update or create daily limit record
    if (dailyLimit) {
      await ctx.db.patch(dailyLimit._id, { requestCount: used + 1 });
    } else {
      await ctx.db.insert("userDailyLimits", {
        userId,
        date: today,
        requestCount: 1,
      });
    }

    // Create fact-check request
    const requestId = await ctx.db.insert("factCheckRequests", {
      userId,
      url: args.url,
      status: "pending",
    });

    // Schedule the fact-checking process
    await ctx.scheduler.runAfter(0, internal.factCheckInternal.processFactCheck, {
      requestId,
    });

    return requestId;
  },
});

// Get fact-check result
export const getFactCheckResult = query({
  args: { requestId: v.id("factCheckRequests") },
  returns: v.union(
    v.object({
      status: v.literal("pending"),
    }),
    v.object({
      status: v.literal("completed"),
      result: v.string(),
      authenticityScore: v.number(),
    }),
    v.object({
      status: v.literal("failed"),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request || request.userId !== userId) {
      throw new Error("Request not found");
    }

    if (request.status === "pending") {
      return { status: "pending" as const };
    } else if (request.status === "completed") {
      return {
        status: "completed" as const,
        result: request.result!,
        authenticityScore: request.authenticityScore!,
      };
    } else {
      return {
        status: "failed" as const,
        error: "Processing failed",
      };
    }
  },
});


// Internal function to get request details
export const getRequest = internalQuery({
  args: { requestId: v.id("factCheckRequests") },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      url: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    return request ? {
      userId: request.userId,
      url: request.url,
      status: request.status,
    } : null;
  },
});

// Internal function to update request
export const updateRequest = internalMutation({
  args: {
    requestId: v.id("factCheckRequests"),
    result: v.string(),
    authenticityScore: v.number(),
    status: v.union(v.literal("completed"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      result: args.result,
      authenticityScore: args.authenticityScore,
      status: args.status,
    });
    return null;
  },
});
