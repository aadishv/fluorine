# Social Media Fact Checker

A web application that verifies the authenticity of social media posts using AI analysis.

## Key Features

- **Authentication Required**: Sign in to get access to fact-checking services
- **Daily Rate Limiting**: Users get 20 requests per day (ephemeral - resets on refresh)
- **URL-Based Analysis**: Simply paste a social media post URL to fact-check
- **AI-Powered Verification**: Uses Google Gemini 2.5 Flash with search grounding
- **Visual Authenticity Score**: Displays results with a speedometer interface (0-100)
- **Comprehensive Analysis**: Extracts and analyzes both text content and images
- **Streaming Results**: Real-time display of fact-checking results

## Technologies

- **Convex** for the backend with real-time capabilities
- **React + Vite** for the frontend
- **Tailwind + shadcn** for styling
- **Convex Auth** for authentication (Google/GitHub)
- **Google Gemini AI** for fact-checking analysis
- **Vercel AI SDK** for streaming AI responses
- **r.jina.ai** for extracting readable content from social media posts

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Convex
CONVEX_DEPLOYMENT=your-convex-deployment-url
VITE_CONVEX_URL=your-convex-url

# Google Gemini AI API Key (required for fact-checking)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key

# OAuth Providers (for authentication)
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
AUTH_GITHUB_ID=your-github-oauth-client-id
AUTH_GITHUB_SECRET=your-github-oauth-client-secret
```

### Getting API Keys:

1. **Google Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey) to get your API key
2. **Google OAuth**: Set up at [Google Cloud Console](https://console.cloud.google.com/)
3. **GitHub OAuth**: Configure at [GitHub Developer Settings](https://github.com/settings/developers)

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see above)
4. Start development servers: `npm run dev`
5. Follow Convex Auth docs for detailed authentication setup

## How It Works

1. **Authentication**: Users must sign in with Google or GitHub
2. **URL Input**: Enter a social media post URL in the centered input box
3. **Content Extraction**: System fetches content via r.jina.ai API
4. **AI Analysis**: Gemini 2.5 Flash analyzes text and images with search grounding
5. **Scoring**: AI provides authenticity score (0-100) via tool calling
6. **Results Display**: Streaming Markdown results with visual score display

## Rate Limiting

- Each authenticated user gets 20 requests per day
- Requests are ephemeral (reset on page refresh/sign out)
- Clear disclaimer shown in the interface
- Rate limit enforced both client and server-side

## Deployment

Designed for deployment on Vercel with Convex backend.

## Disclaimer

This tool provides AI-generated analysis for informational purposes only. Always verify important information through multiple reliable sources.
