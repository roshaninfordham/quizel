import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Users, Zap } from "lucide-react";
import type React from "react";
import type { LiveStats, Participant, Score, Session } from "@quizrush/shared";
import { BracketConnectorSvg } from "./BracketConnectorSvg";
import { BracketNodeAvatar } from "./BracketNodeAvatar";
import { useBracketLayout } from "./useBracketLayout";

export function CleanKnockoutBracket({
  entries,
  session,
  stats,
  activeRacers = entries.length,
  raceSecondsRemaining = 25,
  nextGateSeconds = 3,
  capacityLabel
}: {
  entries: Array<{ participant: Participant; score: Score }>;
  session?: Session;
  stats?: LiveStats;
  activeRacers?: number;
  raceSecondsRemaining?: number;
  nextGateSeconds?: number;
  capacityLabel?: string;
}) {
  const layout = useBracketLayout({ entries, session });

  if (!layout.admitted.length) {
    return (
      <section className="relative grid min-h-[620px] place-items-center overflow-hidden rounded-[28px] bg-[#050B2E] p-8 text-center text-white shadow-2xl shadow-slate-300/60">
        <div>
          <div className="mx-auto grid size-24 place-items-center rounded-full border border-white/15 bg-white/8 text-5xl">
            <Users className="size-12 text-blue-200" />
          </div>
          <h2 className="mt-6 text-5xl font-black tracking-normal">Live Bracket</h2>
          <p className="mt-3 text-xl font-bold text-slate-300">Waiting for racers to scan the QR and enter the sprint.</p>
        </div>
      </section>
    );
  }

  if (layout.admitted.length === 1) {
    const entry = layout.admitted[0];
    return (
      <section className="relative grid min-h-[620px] place-items-center overflow-hidden rounded-[28px] bg-[#050B2E] p-8 text-center text-white shadow-2xl shadow-slate-300/60">
        <div>
          <div className="mx-auto grid size-28 place-items-center rounded-full border-[4px] border-amber-300 bg-white text-6xl shadow-2xl shadow-amber-300/30">
            {entry?.participant.avatar}
          </div>
          <p className="mt-6 text-sm font-black uppercase text-amber-200">Solo Sprint Mode</p>
          <h2 className="mt-2 text-6xl font-black tracking-normal">{entry?.participant.displayName}</h2>
          <p className="mt-3 text-xl font-bold text-slate-300">Waiting for more racers to form the bracket.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[620px] overflow-hidden rounded-[28px] bg-[#050B2E] p-6 text-white shadow-2xl shadow-slate-300/60">
      <div className="relative z-20 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-200">Public tournament broadcast</p>
          <h2 className="mt-1 text-5xl font-black tracking-normal">Live Bracket</h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-sm font-black">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-blue-100">
            <Zap className="size-4" />
            {Math.max(0, raceSecondsRemaining)}s race
          </span>
          <span className="rounded-full bg-amber-400 px-3 py-2 text-slate-950">Next cut {Math.max(0, nextGateSeconds)}s</span>
          {capacityLabel ? <span className="rounded-full bg-white/10 px-3 py-2 text-blue-100">{capacityLabel}</span> : null}
        </div>
      </div>

      <div className="relative mt-8 h-[500px] rounded-[24px] border border-white/10 bg-[#0B1437]">
        <div className="absolute inset-x-5 top-4 z-20 flex justify-between">
          {layout.stages.map((stage) => (
            <div key={stage.stageIndex} className="min-w-16 text-center">
              <p className={stage.size === 1 ? "text-xs font-black uppercase text-amber-200" : "text-xs font-black uppercase text-slate-400"}>
                {stage.label}
              </p>
            </div>
          ))}
        </div>

        <BracketConnectorSvg connectors={layout.connectors} />

        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {layout.nodes.map((node) => (
              <BracketNodeAvatar key={node.id} node={node} />
            ))}
          </AnimatePresence>
        </LayoutGroup>

        {layout.overflowCount ? (
          <motion.div
            layout
            className="absolute bottom-5 right-5 z-20 grid size-20 place-items-center rounded-full border border-white/15 bg-white/10 text-center shadow-xl"
          >
            <div>
              <p className="text-xl font-black">+{layout.overflowCount}</p>
              <p className="text-[10px] font-black uppercase text-slate-300">racing</p>
            </div>
          </motion.div>
        ) : null}
      </div>

      <div className="relative z-20 mt-4 grid grid-cols-4 gap-3 text-sm font-black">
        <BracketStat label="active racers" value={activeRacers} />
        <BracketStat label="answers/sec" value={stats?.answersPerSec ?? 0} />
        <BracketStat label="reducers" value={stats?.reducerCalls ?? 0} />
        <BracketStat label="duplicate taps" value={stats?.duplicateAnswersRejected ?? 0} />
      </div>
    </section>
  );
}

function BracketStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
