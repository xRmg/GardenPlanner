import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader2, Mail, Sprout } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { ApiError, apiJson } from "../lib/api";

interface PreviewDelivery {
  channel: "preview";
  token: string;
  expiresAt: string;
}

interface SignUpResponse {
  requiresEmailVerification: boolean;
  delivery?: PreviewDelivery;
}

interface SignInResponse {
  success: boolean;
  requiresEmailVerification?: boolean;
  delivery?: PreviewDelivery;
}

interface RecoveryRequestResponse {
  success: boolean;
  delivery?: PreviewDelivery;
}

interface RecoveryConfirmResponse {
  success: boolean;
  requiresEmailVerification?: boolean;
  delivery?: PreviewDelivery;
}

interface VerificationResponse {
  success: boolean;
}

export function HostedAuthScreen() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recovery">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewToken, setPreviewToken] = useState<PreviewDelivery | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify");
    const resetToken = params.get("recovery");

    if (verifyToken) {
      setMode("sign-up");
      setVerificationToken(verifyToken);
    }

    if (resetToken) {
      setMode("recovery");
      setRecoveryToken(resetToken);
    }
  }, []);

  const headerCopy = useMemo(() => {
    if (mode === "sign-up") {
      return {
        title: t("auth.signUpTitle"),
        description: t("auth.signUpDescription"),
      };
    }
    if (mode === "recovery") {
      return {
        title: t("auth.recoveryTitle"),
        description: t("auth.recoveryDescription"),
      };
    }
    return {
      title: t("auth.signInTitle"),
      description: t("auth.signInDescription"),
    };
  }, [mode, t]);

  const resetMessages = () => {
    setError("");
    setNotice("");
  };

  const reloadHostedApp = () => {
    window.location.reload();
  };

  const handleSignUp = async () => {
    resetMessages();
    if (!email.trim() || !password.trim()) {
      setError(t("auth.emailAndPasswordRequired"));
      return;
    }
    if (password.length < 10) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await apiJson<SignUpResponse>("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          locale: i18n.language,
        }),
      });
      setPreviewToken(response.delivery ?? null);
      setVerificationToken(response.delivery?.token ?? "");
      setNotice(t("auth.verificationSent"));
    } catch (signUpError) {
      setError(
        signUpError instanceof Error ? signUpError.message : t("auth.signUpFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    resetMessages();
    if (!verificationToken.trim()) {
      setError(t("auth.verificationTokenRequired"));
      return;
    }

    setLoading(true);
    try {
      await apiJson<VerificationResponse>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: verificationToken }),
      });
      reloadHostedApp();
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : t("auth.verificationFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    resetMessages();
    if (!email.trim() || !password.trim()) {
      setError(t("auth.emailAndPasswordRequired"));
      return;
    }

    setLoading(true);
    try {
      const response = await apiJson<SignInResponse>("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (response.requiresEmailVerification) {
        setMode("sign-up");
        setPreviewToken(response.delivery ?? null);
        setVerificationToken(response.delivery?.token ?? "");
        setNotice(t("auth.verifyBeforeSignIn"));
        return;
      }

      reloadHostedApp();
    } catch (signInError) {
      setError(
        signInError instanceof Error ? signInError.message : t("auth.signInFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecovery = async () => {
    resetMessages();
    if (!email.trim()) {
      setError(t("auth.emailRequired"));
      return;
    }

    setLoading(true);
    try {
      const response = await apiJson<RecoveryRequestResponse>(
        "/api/auth/recovery/request",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setPreviewToken(response.delivery ?? null);
      setRecoveryToken(response.delivery?.token ?? "");
      setNotice(t("auth.recoverySent"));
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : t("auth.recoveryRequestFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRecovery = async () => {
    resetMessages();
    if (!recoveryToken.trim()) {
      setError(t("auth.recoveryTokenRequired"));
      return;
    }
    if (!recoveryPassword.trim()) {
      setError(t("auth.passwordRequired"));
      return;
    }
    if (recoveryPassword.length < 10) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (recoveryPassword !== recoveryConfirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await apiJson<RecoveryConfirmResponse>(
        "/api/auth/recovery/confirm",
        {
        method: "POST",
        body: JSON.stringify({
          token: recoveryToken,
          password: recoveryPassword,
        }),
        },
      );

      if (response.requiresEmailVerification) {
        setMode("sign-up");
        setPreviewToken(response.delivery ?? null);
        setVerificationToken(response.delivery?.token ?? "");
        setNotice(t("auth.verifyBeforeSignIn"));
        return;
      }

      reloadHostedApp();
    } catch (recoveryError) {
      if (
        recoveryError instanceof ApiError &&
        recoveryError.data &&
        typeof recoveryError.data === "object" &&
        "requiresEmailVerification" in recoveryError.data &&
        (recoveryError.data as { requiresEmailVerification?: boolean })
          .requiresEmailVerification
      ) {
        const payload = recoveryError.data as {
          delivery?: PreviewDelivery;
        };
        setMode("sign-up");
        setPreviewToken(payload.delivery ?? null);
        setVerificationToken(payload.delivery?.token ?? "");
        setNotice(t("auth.verifyBeforeSignIn"));
        return;
      }

      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : t("auth.recoveryConfirmFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const showPreviewToken = previewToken?.channel === "preview";

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-stretch">
        <Card className="lg:w-[22rem] lg:shrink-0">
          <CardHeader>
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sprout className="size-6" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">
              Garden Planner
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("auth.marketingBlurb")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
              <p className="font-semibold text-foreground">{t("auth.hostedBenefitsTitle")}</p>
              <ul className="mt-2 space-y-2">
                <li>{t("auth.hostedBenefitOne")}</li>
                <li>{t("auth.hostedBenefitTwo")}</li>
                <li>{t("auth.hostedBenefitThree")}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={mode === "sign-in" ? "default" : "outline"}
                onClick={() => {
                  setMode("sign-in");
                  resetMessages();
                }}
              >
                {t("auth.signInTab")}
              </Button>
              <Button
                variant={mode === "sign-up" ? "default" : "outline"}
                onClick={() => {
                  setMode("sign-up");
                  resetMessages();
                }}
              >
                {t("auth.signUpTab")}
              </Button>
              <Button
                variant={mode === "recovery" ? "default" : "outline"}
                onClick={() => {
                  setMode("recovery");
                  resetMessages();
                }}
              >
                {t("auth.recoveryTab")}
              </Button>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">
              {headerCopy.title}
            </CardTitle>
            <CardDescription>{headerCopy.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>{t("common.error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {notice && (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>{t("auth.noticeTitle")}</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}

            {showPreviewToken && (
              <Alert>
                <Mail className="size-4" />
                <AlertTitle>{t("auth.previewTokenTitle")}</AlertTitle>
                <AlertDescription>
                  <p>{t("auth.previewTokenDescription")}</p>
                  <code className="mt-2 block rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
                    {previewToken.token}
                  </code>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(previewToken.expiresAt).toLocaleString(i18n.language)}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="hosted-auth-email">{t("auth.emailLabel")}</Label>
                <Input
                  id="hosted-auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {mode !== "recovery" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="hosted-auth-password">{t("auth.passwordLabel")}</Label>
                  <Input
                    id="hosted-auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  />
                </div>
              )}

              {mode === "sign-up" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="hosted-auth-password-confirm">
                    {t("auth.confirmPasswordLabel")}
                  </Label>
                  <Input
                    id="hosted-auth-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    autoComplete="new-password"
                  />
                </div>
              )}
            </div>

            {mode === "sign-in" && (
              <Button className="w-full" onClick={handleSignIn} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("auth.signInAction")}
              </Button>
            )}

            {mode === "sign-up" && (
              <div className="space-y-4">
                <Button className="w-full" onClick={handleSignUp} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("auth.signUpAction")}
                </Button>

                <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <Label htmlFor="hosted-auth-verification-token">
                    {t("auth.verificationTokenLabel")}
                  </Label>
                  <Input
                    id="hosted-auth-verification-token"
                    value={verificationToken}
                    onChange={(event) => setVerificationToken(event.target.value)}
                    placeholder={t("auth.verificationTokenPlaceholder")}
                    autoComplete="one-time-code"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleVerifyEmail}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("auth.verifyEmailAction")}
                  </Button>
                </div>
              </div>
            )}

            {mode === "recovery" && (
              <div className="space-y-4">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleRequestRecovery}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("auth.requestRecoveryAction")}
                </Button>

                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="hosted-auth-recovery-token">
                      {t("auth.recoveryTokenLabel")}
                    </Label>
                    <Input
                      id="hosted-auth-recovery-token"
                      value={recoveryToken}
                      onChange={(event) => setRecoveryToken(event.target.value)}
                      placeholder={t("auth.recoveryTokenPlaceholder")}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hosted-auth-recovery-password">
                      {t("auth.newPasswordLabel")}
                    </Label>
                    <Input
                      id="hosted-auth-recovery-password"
                      type="password"
                      value={recoveryPassword}
                      onChange={(event) => setRecoveryPassword(event.target.value)}
                      placeholder={t("auth.passwordPlaceholder")}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hosted-auth-recovery-password-confirm">
                      {t("auth.confirmPasswordLabel")}
                    </Label>
                    <Input
                      id="hosted-auth-recovery-password-confirm"
                      type="password"
                      value={recoveryConfirmPassword}
                      onChange={(event) =>
                        setRecoveryConfirmPassword(event.target.value)
                      }
                      placeholder={t("auth.passwordPlaceholder")}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button className="w-full" onClick={handleConfirmRecovery} disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("auth.resetPasswordAction")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
