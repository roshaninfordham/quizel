import { DEFAULT_SESSION_ID } from "@quizduel/shared";
import { Button, Panel } from "../components/ui";
import { ChampionReveal } from "../screens/ChampionReveal";
import { CrowdPhone } from "../screens/CrowdPhone";
import { FinalLeaderboard } from "../screens/FinalLeaderboard";
import { HostConsole } from "../screens/HostConsole";
import { MobileJoin } from "../screens/MobileJoin";
import { PlayerPhone } from "../screens/PlayerPhone";
import { ProjectorArena } from "../screens/ProjectorArena";
import { ProjectorLobby } from "../screens/ProjectorLobby";
import { TechProof } from "../screens/TechProof";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/host";
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "host") {
    return <HostConsole />;
  }

  if (parts[0] === "lobby") {
    return <ProjectorLobby sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  if (parts[0] === "join") {
    return <MobileJoin joinCode={parts[1] ?? "ARENA-42"} />;
  }

  if (parts[0] === "arena" && parts[2] === "reveal") {
    return <ChampionReveal sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  if (parts[0] === "arena" && parts[2] === "final") {
    return <FinalLeaderboard sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  if (parts[0] === "arena") {
    return <ProjectorArena sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  if (parts[0] === "play") {
    return <PlayerPhone sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  if (parts[0] === "crowd") {
    return <CrowdPhone sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  if (parts[0] === "tech") {
    return <TechProof sessionId={parts[1] ?? DEFAULT_SESSION_ID} />;
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Panel className="max-w-lg text-center">
        <h1 className="text-4xl font-black text-slate-950">QuizDuel Live</h1>
        <p className="mt-2 text-base font-bold text-slate-600">Route not found. Open the host console to run the demo.</p>
        <a href="/host">
          <Button className="mt-5">Open Host Console</Button>
        </a>
      </Panel>
    </main>
  );
}
