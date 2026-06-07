import { Trophy } from "lucide-react";
import { DEFAULT_SESSION_CODE, QUESTION_COUNT } from "@quizrush/shared";
import { Button, Panel, PhoneShell } from "../components/ui";
import { useSpacetime } from "../lib/spacetime/client";

export function ShareRoute({ slug }: { slug: string }) {
  const { state } = useSpacetime();
  const share = state.shareCards.find((candidate) => candidate.slug === slug);
  const session = share ? state.sessions.find((candidate) => candidate.sessionId === share.sessionId) : undefined;
  const joinPath = `/join/${session?.code ?? DEFAULT_SESSION_CODE}`;

  return (
    <PhoneShell>
      <Panel className="mt-auto text-center">
        {share ? (
          <>
            <div className="mx-auto grid size-28 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-6xl shadow-xl shadow-amber-100">
              {share.avatar}
            </div>
            <p className="mt-6 text-sm font-black uppercase text-violet-700">QuizRush Arena result</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950">
              {share.displayName} placed #{share.finalRank}
            </h1>
            <p className="mt-3 text-lg font-bold text-slate-500">
              {share.championStatus === "champion" ? "Champion path winner" : "25-second sprint finisher"}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <ShareStat label="Score" value={share.totalScore.toLocaleString()} />
              <ShareStat label="Correct" value={`${share.correctCount}/${share.questionCount || QUESTION_COUNT}`} />
              <ShareStat label="Fastest" value={`${((share.fastestResponseMs ?? 0) / 1000).toFixed(2)}s`} />
              <ShareStat label="Room" value={`${share.totalParticipants} racers`} />
            </div>
          </>
        ) : (
          <>
            <Trophy className="mx-auto size-20 text-amber-500" />
            <h1 className="mt-4 text-4xl font-black text-slate-950">Score card not found</h1>
            <p className="mt-2 text-base font-bold text-slate-500">The share row may not have synced yet or the link is invalid.</p>
          </>
        )}
        <Button onClick={() => window.location.assign(joinPath)} className="mt-8 w-full">
          Race your topic
        </Button>
      </Panel>
      <div className="mt-auto" />
    </PhoneShell>
  );
}

function ShareStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
