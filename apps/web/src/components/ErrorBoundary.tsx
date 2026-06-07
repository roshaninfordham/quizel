import React, { useCallback } from "react";
import { DEFAULT_SESSION_CODE, DEFAULT_SESSION_ID } from "@quizrush/shared";
import { getDeviceIdentity, getJoinedParticipantId, useSpacetime } from "../lib/spacetime/client";

type ErrorScope = "phone" | "projector" | "share" | "app";

interface BoundaryState {
  error: Error | null;
}

interface BoundaryProps {
  children: React.ReactNode;
  scope: ErrorScope;
  code?: string;
  sessionId?: string;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

export function ClientErrorBoundary({
  children,
  scope,
  code = DEFAULT_SESSION_CODE,
  sessionId = DEFAULT_SESSION_ID
}: {
  children: React.ReactNode;
  scope: ErrorScope;
  code?: string;
  sessionId?: string;
}) {
  const { callReducer, connectionState } = useSpacetime();
  const reportError = useCallback(
    (error: Error, info: React.ErrorInfo) => {
      if (connectionState !== "connected") return;
      const participantId = scope === "phone" ? getJoinedParticipantId(code) : null;
      const componentStack = info.componentStack ?? "";
      const metadata = {
        path: window.location.pathname,
        componentStack: componentStack.slice(0, 3500),
        connectionState
      };
      void callReducer(
        "record_client_error",
        {
          sessionId,
          participantId,
          screen: scope,
          errorCode: "react_error_boundary",
          message: error.message || "React render error",
          stackHash: hashText(`${error.message}:${error.stack ?? ""}:${componentStack}`),
          metadataJson: JSON.stringify(metadata),
          userAgent: window.navigator.userAgent
        },
        getDeviceIdentity()
      ).catch(() => undefined);
    },
    [callReducer, code, connectionState, scope, sessionId]
  );

  return (
    <ErrorBoundaryCore code={code} scope={scope} onError={reportError}>
      {children}
    </ErrorBoundaryCore>
  );
}

class ErrorBoundaryCore extends React.Component<BoundaryProps, BoundaryState> {
  public override state: BoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  public override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  public override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return <RecoveryScreen code={this.props.code ?? DEFAULT_SESSION_CODE} scope={this.props.scope} onRetry={() => this.setState({ error: null })} />;
  }
}

function RecoveryScreen({ code, scope, onRetry }: { code: string; scope: ErrorScope; onRetry: () => void }) {
  const title = scope === "phone" ? "Rejoining your sprint" : "Recovering the live view";
  const description =
    scope === "phone"
      ? "This phone hit a recoverable render error. Your official score lives in SpacetimeDB, so retry or rejoin without losing the database result."
      : "The realtime state is still in SpacetimeDB. Retry the view while the live race continues.";

  const rejoin = () => {
    window.localStorage.removeItem(`quizrush-arena-participant-${code}`);
    window.location.assign(`/join/${code}`);
  };

  return (
    <main className="min-h-screen bg-[#fff8ec] px-5 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[460px] flex-col justify-end">
        <div className="rounded-[32px] bg-white p-6 shadow-2xl shadow-slate-200 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase text-violet-700">QuizRush Arena</p>
          <h1 className="mt-3 text-4xl font-black leading-tight">{title}</h1>
          <p className="mt-3 text-base font-bold leading-relaxed text-slate-500">{description}</p>
          <div className="mt-7 grid gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="min-h-14 rounded-[24px] bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-lg font-black text-white shadow-lg shadow-violet-100"
            >
              Retry live state
            </button>
            <button type="button" onClick={rejoin} className="min-h-14 rounded-[24px] bg-slate-100 px-5 text-lg font-black text-slate-900">
              Rejoin from lobby
            </button>
          </div>
          <p className="mt-4 text-sm font-bold text-slate-400">The error was recorded for the technical drawer when the realtime backend was connected.</p>
        </div>
      </section>
    </main>
  );
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `err_${(hash >>> 0).toString(36)}`;
}
