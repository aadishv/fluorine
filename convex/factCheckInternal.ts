"use node";

import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { streamText, tool } from "ai";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { internal } from "./_generated/api";
import { z } from "zod";


// Helper function to extract image URLs from markdown
function extractImageUrls(markdown: string): string[] {
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    if (!match[1].includes("svg")) {
      urls.push(match[1]);
    }
  }

  return urls;
}


const system = `Please fact-check the following social media post content and verify its authenticity. Provide detailed analysis including:

1. Verification of key claims made in the post
2. Cross-reference with reliable sources
3. Identification of any misleading or false information
4. Overall assessment of credibility
5. Call the setAuthenticityScore tool to set the final authenticity score from 0-100 (0 = completely false, 100 = completely true). ALWAYS call this at the end of your turn.

Here's the content to fact-check:
`;

// Internal function to process fact-checking
export const processFactCheck = internalAction({
  args: { requestId: v.id("factCheckRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // try {
      const request = await ctx.runQuery(internal.factCheck.getRequest, {
        requestId: args.requestId,
      });

      if (!request) {
        throw new Error("Request not found");
      }

      // Fetch content from r.jina.ai
      const jinaUrl = `https://r.jina.ai/${request.url}`;
      const response = await fetch(jinaUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const content = await response.text();
      console.log(content);
      // Extract image URLs from markdown
      const imageUrls = extractImageUrls(content);
      console.log("here6");
      // Process with Gemini
      const genAI = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      });

      let authenticityScore = 50; // Default score

      const result = streamText({
        model: genAI("gemini-2.5-flash-lite"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${system} \n\n ${content}`,
              },
              ...imageUrls.map((url) => ({
                type: "image" as const,
                image: url,
              })),
            ],
          },
        ],
        tools: {
          setAuthenticityScore: tool({
            description: "Set the final authenticity score from 0-100 (0 = completely false, 100 = completely true). ALWAYS call this at the end of your turn.",
            inputSchema: z.object({
              score: z.number().min(0).max(100).describe("Authenticity score from 0-100"),
              reasoning: z.string().describe("Brief explanation for the score"),
            }),
            execute: async ({ score, reasoning }) => {
              console.log("hi");
              return `Score set to ${score}: ${reasoning}`;
            },
          }),
          google_search: google.tools.googleSearch({}),
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
      console.log("here3");
      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      console.log("here2");
      // Process tool calls to get authenticity score
      for await (const part of result.fullStream) {
        if (part.type === "tool-call" && part.toolName === "setAuthenticityScore") {
          authenticityScore = (part as any).args.score;
        }
      }
      console.log("here");
      // Update the request with results
      await ctx.runMutation(internal.factCheck.updateRequest, {
        requestId: args.requestId,
        result: fullText,
        authenticityScore,
        status: "completed",
      });

    // } catch (error) {
    //   console.error("Fact-check processing failed:", error);
    //   await ctx.runMutation(internal.factCheck.updateRequest, {
    //     requestId: args.requestId,
    //     result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    //     authenticityScore: 0,
    //     status: "failed",
    //   });
    // }

    return null;
  },
});
