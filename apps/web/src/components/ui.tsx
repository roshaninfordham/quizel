import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  Zap
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_TOPICS,
  DISCLAIMER,
  QUESTION_COUNT,
  type AgentEvent,
  type LiveStats,
  type MatchEvent,
  type OptionKey,
  type Participant,
  type Question,
  type Round,
  type Score,
  percentile
} from "@quizrush/shared";
import type { ConnectionState } from "../lib/spacetime/client";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function ProjectorShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="projector-grid min-h-screen overflow-hidden px-10 py-7 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[1760px] flex-col gap-5">{children}</div>
      <Footer compact />
    </main>
  );
}

export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] flex-col gap-4">{children}</div>
      <Footer compact />
    </main>
  );
}

export function Footer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={cn("mx-auto mt-2 max-w-6xl text-center font-semibold text-slate-500", compact ? "text-[11px]" : "text-xs")}>
      {DISCLAIMER}
    </p>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60", className)}>{children}</section>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  icon,
  className,
  type = "button"
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  icon?: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-200 hover:brightness-105",
    secondary: "bg-white text-slate-950 ring-1 ring-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-white/70",
    danger: "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-100 hover:brightness-105",
    success: "bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-100 hover:brightness-105"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-[20px] px-5 py-3 text-base font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function TopStatusBar({
  connectedCount,
  phase,
  p95LatencyMs,
  reducerCalls,
  connectionState,
  lastSyncAt
}: {
  connectedCount: number;
  phase: string;
  p95LatencyMs: number;
  reducerCalls: number;
  connectionState: ConnectionState;
  lastSyncAt: number | null;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/90 px-6 py-4 shadow-xl shadow-slate-200/60 backdrop-blur">
      <div>
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white">
            <Zap className="size-7" />
          </div>
          <div>
            <h1 className="text-4xl font-black leading-none tracking-normal text-slate-950">{APP_NAME}</h1>
            <p className="mt-1 text-xl font-extrabold text-slate-500">{APP_TAGLINE}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-base font-black">
        <StatusPill icon={<Users className="size-5" />} label={`${connectedCount} players`} />
        <StatusPill icon={<Play className="size-5" />} label={phase.replace("_", " ")} />
        <StatusPill icon={<Gauge className="size-5" />} label={`p95 ${p95LatencyMs}ms`} />
        <StatusPill icon={<Activity className="size-5" />} label={`${reducerCalls} reducers`} />
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </div>
    </header>
  );
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-slate-800">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function ConnectionBadge({ state, lastSyncAt }: { state: ConnectionState; lastSyncAt: number | null }) {
  const connected = state === "connected";
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-3 font-black", connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
      {connected ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
      <span>{connected ? "SpacetimeDB Live" : state === "error" ? "Local fallback" : "Reconnecting"}</span>
      <span className="text-slate-500">{lastSyncAt ? `${Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s` : ""}</span>
    </div>
  );
}

export function ReconnectingOverlay({ state }: { state: ConnectionState }) {
  if (state === "connected") return null;
  return (
    <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
      Reconnecting to the laptop realtime server. Local demo state remains available until the connection returns.
    </div>
  );
}

export function QRHeroCard({
  joinUrl,
  sessionCode,
  joinedCount,
  countdownSeconds
}: {
  joinUrl: string;
  sessionCode: string;
  joinedCount: number;
  countdownSeconds: number;
}) {
  return (
    <Panel className="grid min-h-[560px] grid-cols-[minmax(360px,0.9fr)_1.1fr] gap-8 p-8">
      <div className="flex flex-col items-center justify-center rounded-[28px] bg-gradient-to-br from-white to-violet-50 p-8 ring-1 ring-violet-100">
        <div className="rounded-[28px] bg-white p-6 shadow-2xl shadow-violet-200/80">
          <QRCodeSVG value={joinUrl} size={340} level="H" includeMargin />
        </div>
        <div className="mt-6 flex items-center gap-3 text-2xl font-black text-slate-950">
          <QrCode className="size-7 text-violet-600" />
          <span>Scan to join</span>
        </div>
        <p className="mt-2 text-2xl font-black text-violet-700">Session: {sessionCode}</p>
        <p className="mt-4 max-w-[420px] break-all rounded-2xl bg-slate-100 px-4 py-3 text-center text-base font-black text-slate-700">
          {joinUrl}
        </p>
        {isLocalOnlyUrl(joinUrl) ? (
          <p className="mt-3 max-w-[420px] rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-black text-rose-700">
            This QR only works on this laptop. Restart with a LAN host or public tunnel.
          </p>
        ) : (
          <p className="mt-3 max-w-[420px] rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700">
            Phone-ready link
          </p>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-3xl font-black text-slate-500">Players Joined</p>
        <motion.div key={joinedCount} initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="mt-3 text-[132px] font-black leading-none text-slate-950">
          {joinedCount.toString().padStart(3, "0")}
        </motion.div>
        <p className="mt-6 max-w-2xl text-5xl font-black leading-tight text-slate-950">
          One QR code turns the whole room into a live tournament bracket.
        </p>
        <div className="mt-8 inline-flex w-fit items-center gap-3 rounded-full bg-amber-100 px-5 py-4 text-2xl font-black text-amber-800">
          <Clock className="size-7" />
          Match starts in {countdownSeconds}s
        </div>
      </div>
    </Panel>
  );
}

function isLocalOnlyUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function TopicSwarm({
  topicCounts,
  selectedTopic
}: {
  topicCounts: Array<{ topic: string; count: number; percent: number }>;
  selectedTopic?: string | null;
}) {
  const rows = topicCounts.length ? topicCounts : DEFAULT_TOPICS.map((topic) => ({ topic, count: 0, percent: 0 }));
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-black text-slate-950">Topic Swarm</h2>
        {selectedTopic ? <span className="rounded-full bg-violet-100 px-4 py-2 text-base font-black text-violet-700">AI selected: {selectedTopic}</span> : null}
      </div>
      <div className="mt-5 space-y-4">
        {rows.slice(0, 6).map((row, index) => (
          <div key={row.topic}>
            <div className="mb-2 flex items-center justify-between text-xl font-black">
              <span>{row.topic}</span>
              <span className="text-slate-500">{row.percent}%</span>
            </div>
            <div className="h-5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(row.percent, row.count ? 8 : 3)}%` }}
                className={cn(
                  "h-full rounded-full",
                  index === 0 ? "bg-gradient-to-r from-violet-600 to-blue-600" : "bg-gradient-to-r from-cyan-400 to-emerald-400"
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function FloatingAvatarCloud({ participants }: { participants: Participant[] }) {
  return (
    <Panel className="min-h-[258px] overflow-hidden">
      <h2 className="text-3xl font-black text-slate-950">Tournament Wall</h2>
      <div className="mt-5 grid grid-cols-8 gap-3">
        {participants.slice(-40).map((participant) => (
          <motion.div
            key={participant.participantId}
            layout
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid aspect-square place-items-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-3xl shadow-lg shadow-violet-200"
            title={participant.displayName}
          >
            {participant.avatar}
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

export function LiveJoinFeed({ participants }: { participants: Participant[] }) {
  return (
    <Panel>
      <h2 className="text-2xl font-black text-slate-950">Live Join Feed</h2>
      <div className="mt-4 grid gap-3">
        {participants.slice(-6).reverse().map((participant) => (
          <motion.div key={participant.participantId} initial={{ x: 18, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Avatar participant={participant} />
            <span className="text-lg font-black">+ {participant.displayName} entered the race</span>
          </motion.div>
        ))}
        {!participants.length ? <p className="text-lg font-bold text-slate-500">Waiting for the first scan...</p> : null}
      </div>
    </Panel>
  );
}

export function AgentPipeline({ events, status }: { events: AgentEvent[]; status: string }) {
  const steps = [
    { name: "Topic Router Agent", detail: "merged room intent" },
    { name: "Quiz Builder Agent", detail: "generated 5 questions" },
    { name: "Fairness Agent", detail: "approved the pack" },
    { name: "Match Engine", detail: "ready to race" }
  ];
  return (
    <Panel>
      <h2 className="text-3xl font-black text-slate-950">Agent Pipeline</h2>
      <div className="mt-5 grid grid-cols-4 gap-4">
        {steps.map((step) => {
          const event = events.find((candidate) => candidate.agentName === step.name);
          const complete = event?.status === "complete" || event?.status === "fallback";
          const running = status === "generating" && !complete;
          return (
            <div key={step.name} className={cn("rounded-[24px] border p-4", complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
              <div className="flex items-center justify-between">
                <Sparkles className={cn("size-6", complete ? "text-emerald-600" : "text-violet-600")} />
                {complete ? <CheckCircle2 className="size-6 text-emerald-600" /> : running ? <Loader2 className="size-6 animate-spin text-violet-600" /> : null}
              </div>
              <p className="mt-4 text-lg font-black text-slate-950">{step.name}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{event?.content || step.detail}</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function QuestionStage({
  question,
  round,
  answersCount,
  secondsRemaining,
  raceSecondsRemaining
}: {
  question?: Question;
  round?: Round;
  answersCount: number;
  secondsRemaining: number;
  raceSecondsRemaining: number;
}) {
  const options = question
    ? [
        ["A", question.optionA],
        ["B", question.optionB],
        ["C", question.optionC],
        ["D", question.optionD]
      ]
    : [];
  return (
    <Panel className="flex min-h-[620px] flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-violet-100 px-5 py-3 text-xl font-black text-violet-700">
            Question {round?.orderIndex ?? 0} / {QUESTION_COUNT}
          </div>
          <div className="rounded-full bg-slate-950 px-5 py-3 text-xl font-black text-white">
            Race clock {raceSecondsRemaining}s
          </div>
        </div>
        <TimerRing secondsRemaining={secondsRemaining} />
      </div>
      <h2 className="mt-8 text-5xl font-black leading-tight text-slate-950">{question?.questionText ?? "Waiting for the agent-built question pack..."}</h2>
      <div className="mt-8 grid grid-cols-2 gap-4">
        {options.map(([key, value]) => (
          <div key={key} className="rounded-[24px] border-2 border-slate-200 bg-slate-50 p-5 text-2xl font-black text-slate-900">
            <span className="mr-3 inline-grid size-10 place-items-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-lg text-white">{key}</span>
            {value}
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between rounded-[24px] bg-slate-950 px-6 py-5 text-2xl font-black text-white">
        <span>Live answers</span>
        <motion.span key={answersCount} initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
          {answersCount}
        </motion.span>
      </div>
    </Panel>
  );
}

export function TimerRing({ secondsRemaining }: { secondsRemaining: number }) {
  const urgent = secondsRemaining <= 2;
  return (
    <motion.div
      animate={{ scale: urgent ? [1, 1.06, 1] : 1 }}
      transition={{ duration: 0.7, repeat: urgent ? Infinity : 0 }}
      className={cn("grid size-24 place-items-center rounded-full text-4xl font-black text-white", urgent ? "bg-gradient-to-r from-rose-500 to-red-500" : "bg-gradient-to-r from-amber-400 to-orange-400")}
    >
      {Math.max(0, secondsRemaining)}
    </motion.div>
  );
}

export function LeaderboardPanel({ entries, compact = false }: { entries: Array<{ participant: Participant; score: Score }>; compact?: boolean }) {
  return (
    <Panel className="min-h-full">
      <h2 className="text-3xl font-black text-slate-950">Live Leaderboard</h2>
      <div className="mt-5 space-y-3">
        {entries.slice(0, compact ? 7 : 10).map((entry) => (
          <motion.div
            key={entry.participant.participantId}
            layout
            className={cn(
              "flex items-center gap-3 rounded-[20px] px-4 py-3",
              entry.score.currentRank === 1 ? "bg-gradient-to-r from-amber-100 to-orange-100 ring-2 ring-amber-300" : "bg-slate-50"
            )}
          >
            <span className="w-10 text-2xl font-black text-slate-500">#{entry.score.currentRank}</span>
            <Avatar participant={entry.participant} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black text-slate-950">{entry.participant.displayName}</p>
              <p className="text-sm font-bold text-slate-500">{entry.score.correctCount}/{QUESTION_COUNT} correct</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-950">{entry.score.totalScore.toLocaleString()}</p>
              <p className={cn("text-sm font-black", entry.score.previousRank > entry.score.currentRank ? "text-emerald-600" : "text-slate-400")}>
                {entry.score.previousRank > entry.score.currentRank ? "rank up" : "live"}
              </p>
            </div>
          </motion.div>
        ))}
        {!entries.length ? <p className="text-lg font-bold text-slate-500">Scores appear after the first answer.</p> : null}
      </div>
    </Panel>
  );
}

export function TournamentBracket({ entries }: { entries: Array<{ participant: Participant; score: Score }> }) {
  const top = entries.slice(0, 16);
  return (
    <Panel className="min-h-full">
      <h2 className="text-3xl font-black text-slate-950">Top 16 Bracket</h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {top.map((entry) => (
          <motion.div key={entry.participant.participantId} layout className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <span className="w-8 text-lg font-black text-violet-700">#{entry.score.currentRank}</span>
            <Avatar participant={entry.participant} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black">{entry.participant.displayName}</p>
              <p className="text-sm font-bold text-slate-500">{entry.score.totalScore.toLocaleString()} pts</p>
            </div>
          </motion.div>
        ))}
        {!top.length ? <p className="col-span-2 text-lg font-bold text-slate-500">The bracket fills as players answer.</p> : null}
      </div>
    </Panel>
  );
}

export function TechMetricStrip({ stats, eventsCount }: { stats?: LiveStats; eventsCount: number }) {
  return (
    <div className="grid grid-cols-6 gap-3 rounded-[24px] bg-slate-950 p-3 text-white">
      <MetricStripItem label="answers/sec" value={stats?.answersPerSec ?? 0} />
      <MetricStripItem label="reducer calls" value={stats?.reducerCalls ?? 0} />
      <MetricStripItem label="events" value={eventsCount} />
      <MetricStripItem label="duplicate taps" value={stats?.duplicateAnswersRejected ?? 0} />
      <MetricStripItem label="p95 latency" value={`${stats?.p95LatencyMs ?? 48}ms`} />
      <MetricStripItem label="active clients" value={stats?.activeClients ?? 0} />
    </div>
  );
}

function MetricStripItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-white/10 px-4 py-3">
      <p className="text-xs font-black uppercase text-slate-300">{label}</p>
      <motion.p key={String(value)} initial={{ y: 6, opacity: 0.55 }} animate={{ y: 0, opacity: 1 }} className="mt-1 text-2xl font-black">
        {value}
      </motion.p>
    </div>
  );
}

export function WinnerExplosion({ winner, totalPlayers }: { winner?: { participant: Participant; score: Score }; totalPlayers: number }) {
  useEffect(() => {
    if (!winner) return;
    const timer = window.setTimeout(() => {
      void confetti({ particleCount: 180, spread: 95, origin: { y: 0.55 } });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [winner?.participant.participantId]);

  if (!winner) {
    return (
      <Panel className="grid min-h-[620px] place-items-center text-center">
        <div>
          <Trophy className="mx-auto size-20 text-amber-500" />
          <h2 className="mt-5 text-6xl font-black">Waiting for the champion</h2>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="grid min-h-[620px] place-items-center bg-gradient-to-br from-white via-amber-50 to-violet-50 text-center">
      <div>
        <div className="mx-auto grid size-36 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-7xl shadow-2xl shadow-amber-200">
          {winner.participant.avatar}
        </div>
        <p className="mt-8 text-3xl font-black text-amber-700">Champion</p>
        <h2 className="mt-2 text-8xl font-black leading-none text-slate-950">{winner.participant.displayName}</h2>
        <div className="mt-8 grid grid-cols-4 gap-4">
          <WinnerStat label="Score" value={winner.score.totalScore.toLocaleString()} />
          <WinnerStat label="Correct" value={`${winner.score.correctCount}/${QUESTION_COUNT}`} />
          <WinnerStat label="Fastest" value={`${((winner.score.fastestResponseMs ?? 0) / 1000).toFixed(2)}s`} />
          <WinnerStat label="Room" value={`Top ${percentile(winner.score.currentRank, totalPlayers)}%`} />
        </div>
      </div>
    </Panel>
  );
}

function WinnerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white px-6 py-5 shadow-lg shadow-slate-200">
      <p className="text-sm font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function RaceReplay({ events, participants }: { events: MatchEvent[]; participants: Participant[] }) {
  const rankEvents = events.filter((event) => event.eventType === "rank_change" || event.eventType === "score_delta").slice(-12);
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-950">25-Second Race Replay</h2>
        <span className="rounded-full bg-cyan-100 px-4 py-2 text-base font-black text-cyan-700">MatchEvent ledger</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {rankEvents.map((event, index) => {
          const participant = participants.find((candidate) => candidate.participantId === event.participantId);
          return (
            <motion.div key={event.eventId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="rounded-[20px] bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Q{event.roundIndex ?? "-"} · {event.eventType.replace("_", " ")}</p>
              <p className="mt-2 text-lg font-black text-slate-950">{participant?.displayName ?? "Room"} {event.rankAfter ? `moved to #${event.rankAfter}` : "updated"}</p>
              <p className="text-sm font-bold text-slate-500">{event.scoreAfter?.toLocaleString() ?? 0} points</p>
            </motion.div>
          );
        })}
        {!rankEvents.length ? <p className="col-span-3 text-lg font-bold text-slate-500">Replay events appear after answers commit.</p> : null}
      </div>
    </Panel>
  );
}

export function Avatar({ participant }: { participant: Participant }) {
  return (
    <div className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-2xl shadow-md shadow-violet-100">
      {participant.avatar}
    </div>
  );
}

export function AnswerButton({
  optionKey,
  text,
  state,
  onClick
}: {
  optionKey: OptionKey;
  text: string;
  state: "idle" | "locked" | "correct" | "wrong";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state !== "idle"}
      className={cn(
        "flex min-h-16 items-center gap-4 rounded-[22px] border-2 px-4 py-4 text-left text-lg font-black transition active:scale-[0.98] disabled:cursor-not-allowed",
        state === "idle" && "border-slate-200 bg-white text-slate-950 shadow-lg shadow-slate-200/70",
        state === "locked" && "border-violet-200 bg-violet-50 text-violet-800",
        state === "correct" && "border-emerald-300 bg-emerald-50 text-emerald-800",
        state === "wrong" && "border-rose-300 bg-rose-50 text-rose-800"
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-950 text-white">{optionKey}</span>
      <span>{text}</span>
    </button>
  );
}
