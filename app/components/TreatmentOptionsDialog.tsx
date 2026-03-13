import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { AlertCircle, Bug, Leaf, Loader2, Sparkles } from "lucide-react";
import type { PlantInstance } from "./PlanterGrid";
import type { Suggestion } from "./EventsBar";
import type { PestEvent, Settings } from "../data/schema";
import { OpenRouterClient } from "../services/ai/openrouter";
import {
  buildTreatmentOptionsPrompt,
  parseTreatmentOptionsResponse,
  TREATMENT_OPTIONS_SYSTEM_PROMPT,
  type TreatmentMethod,
  type TreatmentOption,
  type TreatmentOptionsResponse,
} from "../services/ai/treatmentOptions";

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const CUSTOM_NOTE_MAX_LENGTH = 180;

const METHOD_LABELS: Record<TreatmentMethod, string> = {
  biological: "Biological",
  mechanical: "Mechanical",
  cultural: "Cultural",
  monitor: "Monitor",
  synthetic: "Synthetic",
};

const METHOD_BADGES: Record<TreatmentMethod, string> = {
  biological: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  mechanical: "bg-sky-50 text-sky-700 border border-sky-200",
  cultural: "bg-amber-50 text-amber-700 border border-amber-200",
  monitor: "bg-slate-50 text-slate-700 border border-slate-200",
  synthetic: "bg-rose-50 text-rose-700 border border-rose-200",
};

export interface TreatmentSuggestionTarget {
  suggestion: Suggestion;
  plantInstance: PlantInstance;
  planterId: string;
  planterName: string;
  areaName: string;
  latestPest: PestEvent;
  latestTreatment?: PestEvent;
}

interface TreatmentOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: TreatmentSuggestionTarget | null;
  settings: Settings;
  onApplyTreatment: (note: string) => void;
}

function buildTreatmentLogNote(option: TreatmentOption): string {
  const value = `${METHOD_LABELS[option.methodType]}: ${option.title} - ${option.summary}`;
  return value.length > CUSTOM_NOTE_MAX_LENGTH
    ? `${value.slice(0, CUSTOM_NOTE_MAX_LENGTH - 1)}...`
    : value;
}

function formatEventDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TreatmentOptionsDialog({
  open,
  onOpenChange,
  target,
  settings,
  onApplyTreatment,
}: TreatmentOptionsDialogProps) {
  const [result, setResult] = useState<TreatmentOptionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [customError, setCustomError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const hasAi = settings.aiProvider.type === "server";

  const promptPayload = useMemo(() => {
    if (!target) return null;
    return buildTreatmentOptionsPrompt({
      plantName: target.plantInstance.plant.name,
      variety:
        target.plantInstance.variety ?? target.plantInstance.plant.variety,
      location: settings.location,
      growthZone: settings.growthZone,
      latestPestNote: target.latestPest.description,
      latestTreatmentNote: target.latestTreatment?.description,
    });
  }, [settings.growthZone, settings.location, target]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      setCustomError("");
      return;
    }

    setCustomNote("");
    setCustomError("");
    setError("");
    setResult(null);

    if (!target || !hasAi || !promptPayload) {
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);

    const proxyUrl = API_BASE ? `${API_BASE}/api/ai/chat` : "/api/ai/chat";
    const client = new OpenRouterClient({
      apiKey: "",
      model: settings.aiModel,
      proxyUrl,
    });

    void client
      .chatCompletionWithFallback(
        [
          { role: "system", content: TREATMENT_OPTIONS_SYSTEM_PROMPT },
          { role: "user", content: promptPayload },
        ],
        {
          temperature: 0.2,
          maxTokens: 1400,
          signal: controller.signal,
        },
      )
      .then(({ content }) => {
        setResult(parseTreatmentOptionsResponse(content));
      })
      .catch((loadError) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load treatment options.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [hasAi, open, promptPayload, retryNonce, settings.aiModel, target]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!target) return null;

  const applySuggestedOption = (option: TreatmentOption) => {
    onApplyTreatment(buildTreatmentLogNote(option));
    onOpenChange(false);
  };

  const applyCustomOption = () => {
    const trimmed = customNote.trim();
    if (!trimmed) {
      setCustomError("Enter a treatment note first.");
      return;
    }
    onApplyTreatment(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-600" />
            Treatment Options
          </DialogTitle>
          <DialogDescription>
            {target.plantInstance.plant.name} in {target.planterName},{" "}
            {target.areaName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <Bug className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" />
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-700/80">
                  Latest Pest Note
                </div>
                <div className="text-sm text-amber-950 mt-1">
                  {target.latestPest.description}
                </div>
                <div className="text-xs text-amber-700/70 mt-1">
                  Logged {formatEventDate(target.latestPest.date)}
                </div>
              </div>
            </div>
            {target.latestTreatment && (
              <div className="mt-3 border-t border-amber-200 pt-3 text-xs text-amber-800">
                Last treatment note: {target.latestTreatment.description}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            Biological and low-toxicity options are shown first. Synthetic
            options, if any, are last-resort only.
          </div>

          {loading && (
            <div className="rounded-xl border border-border/50 bg-white/70 p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <div className="text-sm font-semibold">
                  Generating treatment options
                </div>
                <div className="text-xs text-muted-foreground">
                  Using a short plant and pest snapshot only.
                </div>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-start gap-2 text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">
                    Could not load AI treatment options
                  </div>
                  <div className="text-xs text-red-700/80 mt-1">{error}</div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setError("");
                  setResult(null);
                  setRetryNonce((value) => value + 1);
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && hasAi && result && (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {result.summary}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Confidence: {Math.round(result.confidence * 100)}%
                    </div>
                  </div>
                </div>
              </div>

              {result.verifyFirst && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                  Verify the pest identification before applying stronger
                  treatments.
                </div>
              )}

              {result.options.map((option, index) => (
                <div
                  key={`${option.title}-${index}`}
                  className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {option.title}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {option.summary}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${METHOD_BADGES[option.methodType]}`}
                    >
                      {METHOD_LABELS[option.methodType]}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {option.steps.map((step, stepIndex) => (
                      <div
                        key={stepIndex}
                        className="text-sm text-foreground flex items-start gap-2"
                      >
                        <span className="mt-0.5 text-[10px] font-black text-primary">
                          {stepIndex + 1}.
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>

                  {option.caution && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Caution: {option.caution}
                    </div>
                  )}
                  {typeof option.followUpDays === "number" && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Recheck in {option.followUpDays} day
                      {option.followUpDays === 1 ? "" : "s"}.
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => applySuggestedOption(option)}
                    >
                      Apply This Treatment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasAi && (
            <div className="rounded-xl border border-border/60 bg-white/80 p-4 text-sm text-muted-foreground">
              AI treatment suggestions are unavailable because AI is not
              configured. You can still log a custom treatment below.
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-white/80 p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Custom Treatment
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Always available if you want to record your own treatment
                choice.
              </div>
            </div>
            <textarea
              value={customNote}
              onChange={(event) => {
                setCustomNote(
                  event.target.value.slice(0, CUSTOM_NOTE_MAX_LENGTH),
                );
                if (customError) setCustomError("");
              }}
              placeholder="e.g. Added beneficial nematodes and replaced the mulch around affected plants"
              className="w-full min-h-24 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {customNote.trim().length}/{CUSTOM_NOTE_MAX_LENGTH}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={applyCustomOption}
              >
                Apply Custom Treatment
              </Button>
            </div>
            {customError && (
              <div className="text-xs text-red-600">{customError}</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
