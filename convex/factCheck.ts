"use node";

import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { internal } from "./_generated/api";
import { z } from "zod";

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
    await ctx.scheduler.runAfter(0, internal.factCheck.processFactCheck, {
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

// Internal function to process fact-checking
export const processFactCheck = internalAction({
  args: { requestId: v.id("factCheckRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const request = await ctx.runQuery(internal.factCheck.getRequest, {
        requestId: args.requestId,
      });

      if (!request) {
        throw new Error("Request not found");
      }

      // Fetch content from r.jina.ai
      const jinaUrl = `https://r.jina.ai/${request.url}`;
      const response = await fetch(jinaUrl, {
        headers: {
          'Accept': 'text/markdown',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const content = await response.text();
      
      // Extract image URLs from markdown
      const imageUrls = extractImageUrls(content);

      // Process with Gemini
      const genAI = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      });

      let authenticityScore = 50; // Default score

      const result = await streamText({
        model: genAI("gemini-2.5-flash"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please fact-check the following social media post content and verify its authenticity. Provide detailed analysis including:

1. Verification of key claims made in the post
2. Cross-reference with reliable sources
3. Identification of any misleading or false information
4. Overall assessment of credibility

Here's the content to fact-check:

${content}`,
              },
              ...imageUrls.map((url) => ({
                type: "image" as const,
                image: url,
              })),
            ],
          },
        ],
        tools: {
          setAuthenticityScore: {
            description: "Set the final authenticity score from 0-100 (0 = completely false, 100 = completely true)",
            parameters: z.object({
              score: z.number().min(0).max(100).describe("Authenticity score from 0-100"),
              reasoning: z.string().describe("Brief explanation for the score"),
            }),
            execute: async ({ score, reasoning }) => {
              return `Score set to ${score}: ${reasoning}`;
            },
          },
        },
        providerOptions: {
          google: {
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
            generationConfig: {
              candidateCount: 1,
              maxOutputTokens: 2048,
              temperature: 0.3,
            },
          },
        },
      });

      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      // Process tool calls to get authenticity score
      for await (const part of result.fullStream) {
        if (part.type === "tool-call" && part.toolName === "setAuthenticityScore") {
          authenticityScore = (part as any).args.score;
        }
      }

      // Update the request with results
      await ctx.runMutation(internal.factCheck.updateRequest, {
        requestId: args.requestId,
        result: fullText,
        authenticityScore,
        status: "completed",
      });

    } catch (error) {
      console.error("Fact-check processing failed:", error);
      await ctx.runMutation(internal.factCheck.updateRequest, {
        requestId: args.requestId,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        authenticityScore: 0,
        status: "failed",
      });
    }

    return null;
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

// Helper function to extract image URLs from markdown
function extractImageUrls(markdown: string): string[] {
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
  const urls: string[] = [];
  let match;
  
  while ((match = imageRegex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
}