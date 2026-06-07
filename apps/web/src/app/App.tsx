import { DEFAULT_SESSION_CODE } from "@quizrush/shared";
import { ArenaRoute } from "../routes/ArenaRoute";
import { JoinRoute } from "../routes/JoinRoute";
import { ShareRoute } from "../routes/ShareRoute";
import { TechRoute } from "../routes/TechRoute";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || `/arena/${DEFAULT_SESSION_CODE}`;
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "join") {
    return <JoinRoute code={parts[1] ?? DEFAULT_SESSION_CODE} />;
  }

  if (parts[0] === "tech") {
    return <TechRoute code={parts[1] ?? DEFAULT_SESSION_CODE} />;
  }

  if (parts[0] === "share" && parts[1]) {
    return <ShareRoute slug={parts[1]} />;
  }

  if (parts[0] === "arena") {
    return <ArenaRoute code={parts[1] ?? DEFAULT_SESSION_CODE} />;
  }

  window.history.replaceState(null, "", `/arena/${DEFAULT_SESSION_CODE}`);
  return <ArenaRoute code={DEFAULT_SESSION_CODE} />;
}
