import { DEFAULT_SESSION_CODE } from "@quizrush/shared";
import { ClientErrorBoundary } from "../components/ErrorBoundary";
import { ArenaRoute } from "../routes/ArenaRoute";
import { JoinRoute } from "../routes/JoinRoute";
import { ShareRoute } from "../routes/ShareRoute";
import { TechRoute } from "../routes/TechRoute";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || `/arena/${DEFAULT_SESSION_CODE}`;
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "join") {
    const code = parts[1] ?? DEFAULT_SESSION_CODE;
    return (
      <ClientErrorBoundary scope="phone" code={code}>
        <JoinRoute code={code} />
      </ClientErrorBoundary>
    );
  }

  if (parts[0] === "tech") {
    const code = parts[1] ?? DEFAULT_SESSION_CODE;
    return (
      <ClientErrorBoundary scope="projector" code={code}>
        <TechRoute code={code} />
      </ClientErrorBoundary>
    );
  }

  if (parts[0] === "share" && parts[1]) {
    return (
      <ClientErrorBoundary scope="share">
        <ShareRoute slug={parts[1]} />
      </ClientErrorBoundary>
    );
  }

  if (parts[0] === "arena") {
    const code = parts[1] ?? DEFAULT_SESSION_CODE;
    return (
      <ClientErrorBoundary scope="projector" code={code}>
        <ArenaRoute code={code} />
      </ClientErrorBoundary>
    );
  }

  window.history.replaceState(null, "", `/arena/${DEFAULT_SESSION_CODE}`);
  return (
    <ClientErrorBoundary scope="projector" code={DEFAULT_SESSION_CODE}>
      <ArenaRoute code={DEFAULT_SESSION_CODE} />
    </ClientErrorBoundary>
  );
}
