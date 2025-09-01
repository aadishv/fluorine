import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

export const factCheckValidator = v.union(
  v.object({
    _id: v.id("factCheckRequests"),
    _creationTime: v.number(),
    result: v.optional(v.string()),
    authenticityScore: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    userId: v.id("users"),
    url: v.string(),
  }),
  v.null()
);


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

    const today = new Date().toISOString().split('T')[0];
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


export const submitFactCheck = mutation({
  args: { url: v.string() },
  returns: v.id("factCheckRequests"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }


    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = await ctx.db
      .query("userDailyLimits")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .unique();

    const used = dailyLimit?.requestCount ?? 0;
    if (used >= 20) {
      throw new Error("Daily limit of 20 requests exceeded");
    }


    if (dailyLimit) {
      await ctx.db.patch(dailyLimit._id, { requestCount: used + 1 });
    } else {
      await ctx.db.insert("userDailyLimits", {
        userId,
        date: today,
        requestCount: 1,
      });
    }


    const requestId = await ctx.db.insert("factCheckRequests", {
      userId,
      url: args.url,
      status: "pending",
    });


    await ctx.scheduler.runAfter(0, internal.factCheckInternal.processFactCheck, {
      requestId,
    });

    return requestId;
  },
});

export const getFactCheck = query({
  args: { requestId: v.id("factCheckRequests") },
  returns: factCheckValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const request = await ctx.db.get(args.requestId);
    return request;
  },
});

export const getUserFactChecks = query({
  args: {  },
  returns: v.array(factCheckValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const request = await ctx.db.query("factCheckRequests").withIndex("by_user", q => q.eq("userId", userId)).order("desc").collect();
    return request;
  },
});



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


export const updateRequest = internalMutation({
  args: {
    requestId: v.id("factCheckRequests"),
    result: v.union(v.string(), v.null()),
    status: v.union(v.literal("completed"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      result: args.result ? args.result : undefined,
      status: args.status,
    });
    return null;
  },
});
