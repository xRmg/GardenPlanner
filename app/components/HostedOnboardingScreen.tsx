import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Loader2, MapPin, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { apiJson } from "../lib/api";
import type { HostedSessionState } from "../hooks/useHostedSession";
import type { PreferredAiMode } from "../config/capabilities";

interface OnboardingResponse {
  success: boolean;
}

interface HostedOnboardingScreenProps {
  session: HostedSessionState;
}

export function HostedOnboardingScreen({ session }: HostedOnboardingScreenProps) {
  const { t } = useTranslation();
  const [workspaceName, setWorkspaceName] = useState(
    session.workspace?.name || `${session.user.email.split("@")[0]}'s garden`,
  );
  const [locationQuery, setLocationQuery] = useState("");
  const [preferredAiMode, setPreferredAiMode] = useState<PreferredAiMode>("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!workspaceName.trim()) {
      setError(t("onboarding.workspaceNameRequired"));
      return;
    }
    if (!locationQuery.trim()) {
      setError(t("onboarding.locationRequired"));
      return;
    }

    setLoading(true);
    try {
      await apiJson<OnboardingResponse>("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          workspaceName,
          locationQuery,
          preferredAiMode,
        }),
      });
      window.location.reload();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("onboarding.submitFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-black tracking-tight">
              {t("onboarding.title")}
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {t("onboarding.description", { email: session.user.email })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{t("common.error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="onboarding-workspace-name">
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    {t("onboarding.workspaceNameLabel")}
                  </span>
                </Label>
                <Input
                  id="onboarding-workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder={t("onboarding.workspaceNamePlaceholder")}
                />
                <p className="text-sm text-muted-foreground">
                  {t("onboarding.workspaceNameHint")}
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="onboarding-location">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    {t("onboarding.locationLabel")}
                  </span>
                </Label>
                <Input
                  id="onboarding-location"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder={t("onboarding.locationPlaceholder")}
                />
                <p className="text-sm text-muted-foreground">
                  {t("onboarding.locationHint")}
                </p>
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label>
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    {t("onboarding.aiModeLabel")}
                  </span>
                </Label>
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { value: "none", title: t("onboarding.aiModes.none.title"), description: t("onboarding.aiModes.none.description") },
                    { value: "own-key", title: t("onboarding.aiModes.ownKey.title"), description: t("onboarding.aiModes.ownKey.description") },
                    { value: "managed", title: t("onboarding.aiModes.managed.title"), description: t("onboarding.aiModes.managed.description") },
                  ] as const).map((option) => {
                    const selected = preferredAiMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPreferredAiMode(option.value)}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/60 bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="text-sm font-semibold text-foreground">
                          {option.title}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("onboarding.finishAction")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
