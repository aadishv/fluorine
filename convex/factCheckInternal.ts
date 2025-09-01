"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateText, streamText, tool } from "ai";
import {
  createGoogleGenerativeAI,
  google,
  GoogleGenerativeAIProviderMetadata,
} from "@ai-sdk/google";
import { internal } from "./_generated/api";

const system = `Provided is a social media post. Please research + analyze it and provide detailed analysis with a final score.
BE EXTREMELY CRITICAL. Take the following into account:
1. Is it a scam? (authenticity)
2. Is it a genuine claim? Is it technically correct? (truth)

Examples:
* Post by fake Mark Zuckerberg account - score is decreased on grounds of authenticity. Score: Fake scam.
* Post by Meta that it invented the metaverse - score is decreased on grounds of truth. Score: False claim.
* Post by a Meta moderator that the platform is free of misinformation - score is decreased on grounds of truth. Score: False claim.

**Posts that contain ANY verifiable falsehoods or factual falsities should definitely have a very low score**; and further reductions may be made for severity or repeated false claims. Slight reductions can be made for subjective topics, controversial areas, or personal opinions.

Provide a flowing response for a detailed analysis that doesn't sound robotic. Adopt a conversational tone yet remain very concise. Focus on the notable falsities; parts of the claim that are true should NOT be noted.

Consider your role as protecting users from misinformation; if you are too wordy, users might skip the important parts, and you'll have failed. If you assign too high or lenient of a score, users might think the entire post is correct. Keep this purpose in mind. Based on this, avoid focusing on true aspects; attempt to condense them down into a single point about "What the author is right about" or similar.

Include a note on how to proceed. For example: "Proceed with caution regarding Mark's claims and stay conscient of misinformation on the metaverse."

Example analysis:
"""
# **Scam**
## Proceed with extreme caution.

This is not a real post from Mark Zuckerberg.

* The username is different...
* The claim made, that Meta is giving away 20 bitcoin for free at scam.com, is a false statement. **Do not click on the link** as it is likely scam...
* ...
"""
**ALWAYS follow the above structure. Heading 1 for score -> heading 2 for note -> brief TL;DR -> bullet point details.**

Don't worry about citing sources in your text response; we'll handle that (of course, make sure your response is still informed by sources). Use your provided search tool to find and read sources before coming to a conclusion.
`;

function extractImageUrls(markdown: string): string[] {
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    if (!match[1].includes("svg")) {
      urls.push(match[1]);
    }
  }

  return urls;
}

export const processFactCheck = internalAction({
  args: { requestId: v.id("factCheckRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const request = await ctx.runQuery(internal.factCheck.getRequest, {
        requestId: args.requestId,
      });

      // await new Promise(resolve => setTimeout(resolve, 500000));
      // await ctx.runMutation(internal.factCheck.updateRequest, {
      //   requestId: args.requestId,
      //   result: "Testing mode - simulated failure",
      //   status: "failed",
      // });
      // return null;

      if (!request) {
        throw new Error("Request not found");
      }

      const jinaUrl = `https://r.jina.ai/${request.url}`;
      const response = await fetch(jinaUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const content = await response.text();

      const genAI = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      });
      const imageUrls = extractImageUrls(content);
      const result = await generateText({
        // TODO: switch to flash for prod (?)
        model: genAI("gemini-2.5-flash"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: content,
              },
              ...imageUrls.map((url) => ({
                type: "image" as const,
                image: url,
              })),
            ],
          },
        ],
        tools: {
          google_search: google.tools.googleSearch({}),
        },
        system,
        // stopWhen: stepCou
      });
      let fullText = result.text;
      const chunks = (result.providerMetadata?.google?.groundingMetadata as any)
        ?.groundingChunks as
        | { web: { uri: string; title: string } }[]
        | undefined;
      if (chunks) {
        fullText += "\n\n ## Sources";
        fullText += chunks
          .map((c, i) => `\n ${i + 1}. [${c.web.title}](${c.web.uri})`)
          .join("");
      }
      await ctx.runMutation(internal.factCheck.updateRequest, {
        requestId: args.requestId,
        result: fullText,
        status: "completed",
      });
    } catch (error) {
      console.error("Fact-check processing failed:", error);
      await ctx.runMutation(internal.factCheck.updateRequest, {
        requestId: args.requestId,
        result: error instanceof Error ? error.message : null,
        status: "failed",
      });
    }

    return null;
  },
});
