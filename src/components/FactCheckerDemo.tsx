import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, ExternalLink, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Speedometer from './Speedometer';
import ReactMarkdown from 'react-markdown';

// Mock implementation for demo purposes when Convex is not available
interface MockFactCheckResult {
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  authenticityScore?: number;
}

export default function FactCheckerDemo() {
  const [url, setUrl] = useState('');
  const [currentRequest, setCurrentRequest] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mockResult, setMockResult] = useState<MockFactCheckResult | null>(null);
  const [remainingRequests, setRemainingRequests] = useState(20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      alert('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      alert('Please enter a valid URL');
      return;
    }

    if (remainingRequests <= 0) {
      alert('You have reached your daily limit of 20 requests');
      return;
    }

    setIsSubmitting(true);
    setCurrentRequest(url);
    setMockResult({ status: 'pending' });
    setRemainingRequests(prev => prev - 1);
    
    // Simulate processing time
    setTimeout(() => {
      const mockScore = Math.floor(Math.random() * 100);
      const mockAnalysis = `## Fact-Check Analysis

**Post URL:** ${url}

### Summary
This analysis examines the claims made in the social media post and verifies their authenticity through multiple reliable sources.

### Key Findings
1. **Primary Claim Verification**: The main assertion in the post has been cross-referenced with established fact-checking databases and news sources.

2. **Source Credibility**: Analysis of the original poster's credibility and posting history.

3. **Image Analysis**: If images were present, they were checked for potential manipulation and reverse-searched for original sources.

4. **Context Check**: The timing and context of the post were evaluated for relevance and accuracy.

### Conclusion
Based on the comprehensive analysis, this post has been assigned an authenticity score of **${mockScore}/100**.

${mockScore >= 70 ? '✅ **High Credibility**: Most claims appear to be accurate based on available evidence.' : 
  mockScore >= 40 ? '⚠️ **Mixed Credibility**: Some claims may be accurate but others require caution.' : 
  '❌ **Low Credibility**: Significant concerns about the accuracy of claims made.'}

### Sources Referenced
- Fact-checking databases
- Verified news outlets
- Academic sources
- Official statements

*This analysis is for demonstration purposes.*`;

      setMockResult({
        status: 'completed',
        result: mockAnalysis,
        authenticityScore: mockScore,
      });
      setIsSubmitting(false);
    }, 3000);
  };

  const handleNewCheck = () => {
    setUrl('');
    setCurrentRequest(null);
    setMockResult(null);
  };

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const hasAccess = remainingRequests > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Social Media Fact Checker
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Verify the authenticity of social media posts using AI analysis
          </p>
          
          {/* Demo notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Demo Mode:</strong> This is a demonstration version with mock results. 
              Set up proper environment variables for full functionality.
            </p>
          </div>
          
          {/* Rate limit info */}
          <div className="flex justify-center items-center gap-2 mb-4">
            <Badge variant={hasAccess ? "default" : "destructive"}>
              {remainingRequests} requests remaining today
            </Badge>
            <span className="text-sm text-gray-500">
              (Requests are ephemeral - refreshing will clear your session)
            </span>
          </div>
        </div>

        {/* Input Form */}
        {!currentRequest && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Enter Social Media Post URL</CardTitle>
              <CardDescription>
                Paste the URL of a social media post (Twitter, Facebook, Instagram, etc.) to fact-check its claims
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://x.com/username/status/123456789"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                    disabled={isSubmitting || !hasAccess}
                  />
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !url.trim() || !isValidUrl(url) || !hasAccess}
                    className="px-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Fact Check'
                    )}
                  </Button>
                </div>
                
                {url && !isValidUrl(url) && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Please enter a valid URL
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {currentRequest && mockResult && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {mockResult.status === 'pending' && (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  )}
                  {mockResult.status === 'completed' && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Fact-Check Complete
                    </>
                  )}
                  {mockResult.status === 'failed' && (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      Processing Failed
                    </>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  <a 
                    href={currentRequest} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:underline break-all"
                  >
                    {currentRequest}
                  </a>
                </CardDescription>
              </div>
              <Button onClick={handleNewCheck} variant="outline">
                New Check
              </Button>
            </CardHeader>
            
            <CardContent>
              {mockResult.status === 'pending' && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">
                      Analyzing the post and checking facts...
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      This usually takes 10-30 seconds
                    </p>
                  </div>
                </div>
              )}

              {mockResult.status === 'completed' && (
                <div className="space-y-6">
                  {/* Authenticity Score */}
                  <div className="flex justify-center">
                    <Speedometer score={mockResult.authenticityScore!} />
                  </div>

                  {/* Analysis Results */}
                  <div className="prose max-w-none">
                    <h3 className="text-lg font-semibold mb-3">Analysis Results</h3>
                    <div className="bg-gray-50 rounded-lg p-4 border text-sm leading-relaxed">
                      <ReactMarkdown>
                        {mockResult.result!}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {mockResult.status === 'failed' && (
                <div className="text-center py-8">
                  <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-800 mb-2">
                    Processing Failed
                  </h3>
                  <p className="text-gray-600 mb-4">
                    We couldn't process this URL. This might be due to:
                  </p>
                  <ul className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
                    <li>• The post is private or requires login</li>
                    <li>• The URL is invalid or inaccessible</li>
                    <li>• Temporary server issues</li>
                  </ul>
                  <Button onClick={handleNewCheck} className="mt-4">
                    Try Another URL
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Disclaimer */}
        <div className="mt-8 text-center text-sm text-gray-500 max-w-2xl mx-auto">
          <p className="mb-2">
            <strong>Disclaimer:</strong> This tool provides AI-generated analysis for informational purposes only. 
            Always verify important information through multiple reliable sources.
          </p>
          <p>
            Results are temporary and will be cleared when you refresh the page or sign out.
          </p>
        </div>
      </div>
    </div>
  );
}