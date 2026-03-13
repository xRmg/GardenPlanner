import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  dismissErrorToast,
  ERROR_TOAST_IDS,
  isAbortError,
  notifyErrorToast,
} from "../lib/asyncErrors";
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
  const { t } = useTranslation();
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
        dismissErrorToast(ERROR_TOAST_IDS.treatmentOptions);
      })
      .catch((loadError) => {
        if (isAbortError(loadError)) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load treatment options.",
        );
        notifyErrorToast({
          id: ERROR_TOAST_IDS.treatmentOptions,
          title: "Could not load AI treatment options",
          error: loadError,
          fallback: "Treatment guidance could not be generated.",
        });
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
      setCustomError(t("dialogs.treatmentOptionsDialog.enterNoteFirst"));
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
            {t("dialogs.treatmentOptionsDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("dialogs.treatmentOptionsDialog.subtitle", {
              plant: target.plantInstance.plant.name,
              planter: target.planterName,
              area: target.areaName,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <Bug className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" />
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-700/80">
                  {t("dialogs.treatmentOptionsDialog.latestPestNote")}
                </div>
                <div className="text-sm text-amber-950 mt-1">
                  {target.latestPest.description}
                </div>
                <div className="text-xs text-amber-700/70 mt-1">
                  {t("dialogs.treatmentOptionsDialog.logged", { date: formatEventDate(target.latestPest.date) })}
                </div>
              </div>
            </div>
            {target.latestTreatment && (
              <div className="mt-3 border-t border-amber-200 pt-3 text-xs text-amber-800">
                {t("dialogs.treatmentOptionsDialog.lastTreatmentNote", { note: target.latestTreatment.description })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            {t("dialogs.treatmentOptionsDialog.disclaimer")}
          </div>

          {loading && (
            <div className="rounded-xl border border-border/50 bg-white/70 p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <div className="text-sm font-semibold">
                  {t("dialogs.treatmentOptionsDialog.generating")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("dialogs.treatmentOptionsDialog.generatingNote")}
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
                    {t("dialogs.treatmentOptionsDialog.loadFailed")}
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
                {t("common.retry")}
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
                      {t("dialogs.treatmentOptionsDialog.confidence", { percent: Math.round(result.confidence * 100) })}
                    </div>
                  </div>
                </div>
              </div>

              {result.verifyFirst && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                  {t("dialogs.treatmentOptionsDialog.verifyPest")}
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
                      {t(`dialogs.treatmentOptionsDialog.categoryLabels.${option.methodType}`)}
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
                      {t("dialogs.treatmentOptionsDialog.caution", { text: option.caution })}
                    </div>
                  )}
                  {typeof option.followUpDays === "number" && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t(option.followUpDays === 1 ? "dialogs.treatmentOptionsDialog.recheckIn" : "dialogs.treatmentOptionsDialog.recheckInPlural", { count: option.followUpDays })}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => applySuggestedOption(option)}
                    >
                      {t("dialogs.treatmentOptionsDialog.applyTreatment")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hasAi && (
            <div className="rounded-xl border border-border/60 bg-white/80 p-4 text-sm text-muted-foreground">
              {t("dialogs.treatmentOptionsDialog.noAIConfigured")}
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-white/80 p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {t("dialogs.treatmentOptionsDialog.customTreatment")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("dialogs.treatmentOptionsDialog.customTreatmentHint")}
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
              placeholder={t("dialogs.treatmentOptionsDialog.customPlaceholder")}
              className="w-full min-h-24 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {t("dialogs.treatmentOptionsDialog.charCount", { count: customNote.trim().length, max: CUSTOM_NOTE_MAX_LENGTH })}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={applyCustomOption}
              >
                {t("dialogs.treatmentOptionsDialog.applyCustom")}
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
