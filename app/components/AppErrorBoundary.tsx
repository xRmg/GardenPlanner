import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import i18n from "../i18n/config";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      "[AppErrorBoundary] Unhandled render error:",
      error,
      errorInfo,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl border border-border/20 bg-card p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600/80">
                    {i18n.t("errorBoundary.label")}
                  </p>
                  <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-foreground">
                    {i18n.t("errorBoundary.title")}
                  </h1>
                </div>

                <p className="text-sm text-muted-foreground">
                  {i18n.t("errorBoundary.description")}
                </p>

                {this.state.error?.message && (
                  <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wider text-red-700/80">
                      {i18n.t("errorBoundary.errorDetails")}
                    </p>
                    <p className="mt-1 break-words font-mono text-xs text-red-900">
                      {this.state.error.message}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={this.handleRetry}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-white px-4 py-2 text-sm font-black uppercase tracking-wider text-foreground transition-colors hover:bg-white/80"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {i18n.t("errorBoundary.retryRender")}
                  </button>
                  <button
                    type="button"
                    onClick={this.handleReload}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
                  >
                    {i18n.t("errorBoundary.reloadApp")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
