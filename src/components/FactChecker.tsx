import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Loader2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useQuery, useMutation } from "convex/react";
import api from "../cvx";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { parseAsString, useQueryState } from "nuqs";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { Infer } from "convex/values";
import { factCheckValidator } from "convex/factCheck";
const useReq = () => {
  const [req, setReq] = useQueryState("query", parseAsString);
  return [req as Id<"factCheckRequests">, setReq] as const;
};

function PromptBar() {
  const submitFactCheck = useMutation(api.factCheck.submitFactCheck);
  const [_, setReq] = useReq();
  const [url, setUrl] = useState("");
  const dailyLimit = useQuery(api.factCheck.checkDailyLimit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    setIsSubmitting(true);
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }
    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL");
      return;
    }

    if (!dailyLimit?.hasAccess) {
      toast.error("You have reached your daily limit of 20 requests");
      return;
    }
    try {
      const requestId = (await submitFactCheck({ url })) as string;
      setUrl("");
      await setReq(requestId);
      toast.success("Fact-check request submitted! Processing...");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request",
      );
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-1">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="Enter URL here, i.e., https://x.com/username/status/123456789"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 border-0  p-0 transition-all duration-100 rounded-none"
          disabled={isSubmitting || !dailyLimit?.hasAccess}
        />
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !url.trim() ||
            !isValidUrl(url) ||
            !dailyLimit?.hasAccess
          }
          className="px-6"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Fact Check"
          )}
        </Button>
        {dailyLimit && (
          <Badge variant={dailyLimit.hasAccess ? "outline" : "destructive"}>
            {dailyLimit.remainingRequests} requests remaining today
          </Badge>
        )}
      </div>

      {url && !isValidUrl(url) && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          Please enter a valid URL
        </p>
      )}
    </form>
  );
}
function CheckView(props: { check: Infer<typeof factCheckValidator> }) {
  const { check: check2 } = props;
  const check = check2!;
  const [_, setReq] = useReq();
  return (
    <>
      <Button
        onClick={() => void setReq(null)}
        variant="ghost"
        className="mb-5"
      >
        <ArrowLeft />
      </Button>
      <div className="p-5 rounded-xl bg-white/50">
        <div className="flex">
          <div className="mr-auto">
            <h1
              className={cn(
                "text-2xl font-serif text-primary",
                check.status === "pending"
                  ? "text-black"
                  : check.status === "completed"
                    ? "text-primary"
                    : "text-red-500",
              )}
            >
              {check.status === "pending" && "Request in progress"}
              {check.status === "completed" && "Request complete"}
              {check.status === "failed" &&
                `Processing Failed: error ${check.result ?? "unknown"}`}
            </h1>
            <a
              href={check.url}
              target="_blank"
              className="text-muted-foreground hover:underline break-all"
            >
              Checking {check.url}
            </a>
          </div>
        </div>
        <div>
          {check.status === "pending" && (
            <div className="flex flex-col gap-2">
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-10" />
            </div>
          )}
          {check.status === "completed" && (
            <div className="space-y-6">
              {/* Analysis Results */}
              <div className="prose max-w-none">
                <div className="rounded-lg p-4 leading-relaxed">
                  <ReactMarkdown>{check.result}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {check.status === "failed" && (
            <Button onClick={() => void setReq(null)} className="mt-4 w-full">
              Try Another URL
            </Button>
          )}
        </div>
        {/* Disclaimer */}
        <p className="my-6 text-center text-sm text-gray-500">
          <strong>Disclaimer:</strong> This tool provides AI-generated analysis
          for informational purposes only. Always verify important information
          through multiple reliable sources.
          <br />
          Expect queries to take up to 30 seconds.
        </p>
      </div>
    </>
  );
}
function CheckPreview(props: { check: Infer<typeof factCheckValidator> }) {
  const { check: check2 } = props;
  const [_, setReq] = useReq();
  const check = check2!;
  return (
    <div className="bg-white/50 rounded-xl p-5 my-3" key={check._id}>
      <div className="flex">
        <a
          href={check.url}
          target="_blank"
          className="text-muted-foreground hover:underline break-all"
        >
          Checking {check.url}
        </a>
        <Button onClick={() => void setReq(check._id)} className="ml-auto">
          View <ArrowRight />
        </Button>
      </div>

      <h1
        className={cn(
          "text-xl font-serif text-primary",
          check.status === "pending"
            ? "text-black"
            : check.status === "completed"
              ? "text-primary"
              : "text-red-500",
        )}
      >
        {check.status === "pending" && "Request in progress"}
        {check.status === "completed" && "Request complete"}
        {check.status === "failed" &&
          `Processing Failed: error ${check.result ?? "unknown"}`}
      </h1>
      {check.status === "pending" && <Skeleton className="w-full h-10" />}
      {check.status === "completed" && (
        <ReactMarkdown>{check.result?.slice(0, 100) + " ..."}</ReactMarkdown>
      )}
    </div>
  );
}
export default function FactChecker() {
  const [req, _] = useReq();

  const check = useQuery(
    api.factCheck.getFactCheck,
    req ? { requestId: req } : "skip",
  );

  const history = useQuery(api.factCheck.getUserFactChecks, {});

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        {!req && (
          <>
            <PromptBar />
            {(history && history.length) ? (
              <>
                <h2 className="text-xl font-serif">History</h2>
                {history.map((item) => (
                  <CheckPreview check={item} />
                ))}
              </>
            ) : <></>}
          </>
        )}
        {req && check && <CheckView check={check} />}
      </div>
    </div>
  );
}
