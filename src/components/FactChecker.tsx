import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, ExternalLink, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Speedometer from './Speedometer';
import ReactMarkdown from 'react-markdown';
import { useQuery, useMutation } from 'convex/react';
import api from '../cvx';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';

export default function FactChecker() {
  const [url, setUrl] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState<Id<"factCheckRequests"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get user's daily limit info
  const dailyLimit = useQuery(api.factCheck.checkDailyLimit);
  
  // Get fact-check result if we have a request ID
  const factCheckResult = useQuery(
    api.factCheck.getFactCheckResult,
    currentRequestId ? { requestId: currentRequestId } : "skip"
  );

  // Submit fact-check mutation
  const submitFactCheck = useMutation(api.factCheck.submitFactCheck);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    if (!dailyLimit?.hasAccess) {
      toast.error('You have reached your daily limit of 20 requests');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestId = await submitFactCheck({ url });
      setCurrentRequestId(requestId);
      toast.success('Fact-check request submitted! Processing...');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewCheck = () => {
    setUrl('');
    setCurrentRequestId(null);
  };

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

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
          
          {/* Rate limit info */}
          {dailyLimit && (
            <div className="flex justify-center items-center gap-2 mb-4">
              <Badge variant={dailyLimit.hasAccess ? "default" : "destructive"}>
                {dailyLimit.remainingRequests} requests remaining today
              </Badge>
              <span className="text-sm text-gray-500">
                (Requests are ephemeral - refreshing will clear your session)
              </span>
            </div>
          )}
        </div>

        {/* Input Form */}
        {!currentRequestId && (
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
                    disabled={isSubmitting || !dailyLimit?.hasAccess}
                  />
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !url.trim() || !isValidUrl(url) || !dailyLimit?.hasAccess}
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
        {currentRequestId && factCheckResult && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {factCheckResult.status === 'pending' && (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  )}
                  {factCheckResult.status === 'completed' && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Fact-Check Complete
                    </>
                  )}
                  {factCheckResult.status === 'failed' && (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      Processing Failed
                    </>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:underline break-all"
                  >
                    {url}
                  </a>
                </CardDescription>
              </div>
              <Button onClick={handleNewCheck} variant="outline">
                New Check
              </Button>
            </CardHeader>
            
            <CardContent>
              {factCheckResult.status === 'pending' && (
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

              {factCheckResult.status === 'completed' && (
                <div className="space-y-6">
                  {/* Authenticity Score */}
                  <div className="flex justify-center">
                    <Speedometer score={factCheckResult.authenticityScore} />
                  </div>

                  {/* Analysis Results */}
                  <div className="prose max-w-none">
                    <h3 className="text-lg font-semibold mb-3">Analysis Results</h3>
                    <div className="bg-gray-50 rounded-lg p-4 border text-sm leading-relaxed">
                      <ReactMarkdown>
                        {factCheckResult.result}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {factCheckResult.status === 'failed' && (
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