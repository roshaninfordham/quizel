import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Award,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock,
  Crown,
  Database,
  Flag,
  Gauge,
  Globe2,
  HelpCircle,
  Layers3,
  Menu,
  MousePointerClick,
  Loader2,
  RadioTower,
  Play,
  QrCode,
  Radar,
  Share2,
  ShieldCheck,
  Smartphone,
  Table2,
  TimerReset,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { twMerge } from "tailwind-merge";
import {
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_TOPICS,
  DISCLAIMER,
  QUESTION_COUNT,
  type AgentEvent,
  type ClientError,
  type LiveStats,
  type MatchEvent,
  type OptionKey,
  type Participant,
  type PlayerIntent,
  type Question,
  type QuestionPack,
  type QuizRushState,
  type Round,
  type Score,
  type Session,
  percentile
} from "@quizrush/shared";
import type { ConnectionState } from "../lib/spacetime/client";
import { getMuted, initSounds, setMuted } from "../lib/sound/soundManager";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(clsx(classes));
}

export function ProjectorShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="projector-grid relative h-screen overflow-hidden bg-[#fff8ec] px-7 py-5 pb-7 text-slate-950">
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col gap-3">{children}</div>
      <p className="pointer-events-none absolute inset-x-4 bottom-1 text-center text-[10px] font-semibold text-slate-500">{DISCLAIMER}</p>
    </main>
  );
}

export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fff8ec] px-4 py-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-slate-950">
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
  return <section className={cn("rounded-[32px] bg-white p-5 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200/70", className)}>{children}</section>;
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
  racingCount,
  phase,
  p95LatencyMs,
  reducerCalls,
  connectionState,
  lastSyncAt,
  onToggleTech,
  techOpen = false
}: {
  connectedCount: number;
  racingCount?: number;
  phase: string;
  p95LatencyMs: number;
  reducerCalls: number;
  connectionState: ConnectionState;
  lastSyncAt: number | null;
  onToggleTech?: () => void;
  techOpen?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] bg-white/95 px-5 py-4 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200/70 backdrop-blur">
      <div>
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white">
            <Zap className="size-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black leading-none tracking-normal text-slate-950">{APP_NAME}</h1>
            <p className="mt-1 text-base font-extrabold text-slate-500">Live quiz races from one QR</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm font-black">
        <StatusPill icon={<Users className="size-5" />} label={`${connectedCount} racers`} />
        <StatusPill icon={<Play className="size-5" />} label={phase.replace("_", " ")} />
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        {onToggleTech ? (
          <button
            type="button"
            onClick={onToggleTech}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full transition",
              techOpen ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            )}
            aria-label={techOpen ? "Close technical drawer" : "Open technical drawer"}
            title="Technical details"
          >
            <Menu className="size-5" />
          </button>
        ) : null}
      </div>
    </header>
  );
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-slate-800">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function ConnectionBadge({ state, lastSyncAt }: { state: ConnectionState; lastSyncAt: number | null }) {
  const connected = state === "connected";
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 font-black", connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
      {connected ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
      <span>{connected ? "Realtime Live" : state === "error" ? "Local fallback" : "Reconnecting"}</span>
      <span className="text-slate-500">{lastSyncAt ? `${Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s` : ""}</span>
    </div>
  );
}

export function SoundToggle({ className }: { className?: string }) {
  const [muted, setMutedState] = React.useState(() => getMuted());
  return (
    <button
      type="button"
      onClick={() => {
        initSounds({ mutedByDefault: muted });
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
      className={cn("inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200", className)}
      aria-label={muted ? "Enable sound" : "Mute sound"}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      <span>{muted ? "Sound off" : "Sound on"}</span>
    </button>
  );
}

export function ReconnectingOverlay({ state, floating = false }: { state: ConnectionState; floating?: boolean }) {
  if (state === "connected") return null;
  return (
    <div className={cn("rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900", floating && "fixed right-8 top-24 z-40 max-w-md shadow-xl shadow-amber-100")}>
      Connecting to the live SpacetimeDB race engine. If this takes more than a few seconds, refresh this tab.
    </div>
  );
}

function joinLinkScope(value: string): "local" | "lan" | "public" {
  try {
    const url = new URL(value);
    const hostname = url.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "local";
    if (isPrivateNetworkHost(hostname)) return "lan";
    return "public";
  } catch {
    return "local";
  }
}

function isPrivateNetworkHost(hostname: string): boolean {
  const match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function ProjectorLobbyPage({
  joinUrl,
  sessionCode,
  participants,
  topicCounts,
  selectedTopic,
  stats,
  phase,
  countdownSeconds,
  onStartRace
}: {
  joinUrl: string;
  sessionCode: string;
  participants: Participant[];
  topicCounts: Array<{ topic: string; count: number; percent: number }>;
  selectedTopic?: string | null;
  stats?: LiveStats;
  phase: string;
  countdownSeconds: number;
  onStartRace?: () => void;
}) {
  const canStartRace = participants.some((participant) => participant.admissionStatus === "admitted") && phase === "ready";
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(260px,1fr)_78px_minmax(142px,0.52fr)] gap-3">
      <section className="grid min-h-0 grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] gap-4">
        <QRJoinHero joinUrl={joinUrl} sessionCode={sessionCode} />
        <HeroStatement
          joinedCount={participants.length}
          countdownSeconds={countdownSeconds}
          phase={phase}
          stats={stats}
          canStartRace={canStartRace}
          onStartRace={onStartRace}
        />
      </section>
      <VisualRaceFlow phase={phase} joinedCount={participants.length} topicCount={topicCounts.length} />
      <section className="grid min-h-0 grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] gap-4">
        <RosterPreview participants={participants} maxVisible={24} />
        <div className="grid min-h-0 grid-rows-[1fr_auto] gap-4">
          <TopicBubbleSwarm topicCounts={topicCounts} selectedTopic={selectedTopic} />
          <LiveJoinFeedCompact participants={participants} />
        </div>
      </section>
    </div>
  );
}

function QRJoinHero({ joinUrl, sessionCode }: { joinUrl: string; sessionCode: string }) {
  const scope = joinLinkScope(joinUrl);
  const scopeLabel = scope === "public" ? "Works for phones on any network" : scope === "lan" ? "Use the same reachable network" : "Use public mode for room scanning";

  return (
    <Panel className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(124,58,237,0.12),transparent_34%)]" />
      <motion.div
        animate={{ boxShadow: ["0 0 0 0 rgba(124,58,237,0.18)", "0 0 0 16px rgba(124,58,237,0)", "0 0 0 0 rgba(124,58,237,0)"] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="relative rounded-[28px] bg-white p-4 shadow-2xl shadow-violet-100 ring-1 ring-slate-200"
      >
        <QRCodeSVG value={joinUrl} size={220} level="H" includeMargin />
      </motion.div>
      <div className="relative mt-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-base font-black text-white">
          <QrCode className="size-5" />
          Scan to join
        </div>
        <p className="mt-2 text-xl font-black text-blue-700">Session {sessionCode}</p>
        <p className="mx-auto mt-1 max-w-[360px] break-all text-xs font-extrabold text-slate-500">{joinUrl}</p>
        <p className="mt-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{scopeLabel}</p>
      </div>
    </Panel>
  );
}

function HeroStatement({
  joinedCount,
  countdownSeconds,
  phase,
  stats,
  canStartRace,
  onStartRace
}: {
  joinedCount: number;
  countdownSeconds: number;
  phase: string;
  stats?: LiveStats;
  canStartRace?: boolean;
  onStartRace?: () => void;
}) {
  const statusText = joinedCount ? `Race setup closes in ${countdownSeconds}s` : "Waiting for racers to scan";
  const startLabel = canStartRace ? "Start Race" : phase === "ready" ? "Waiting for racers" : "Waiting for quiz decks";
  return (
    <Panel className="flex min-h-0 flex-col justify-between overflow-hidden p-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">For DevRel demos, hackathons, bootcamps, and live workshops</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Live audience activation game</span>
        </div>
        <h2 className="max-w-5xl text-[clamp(2.35rem,4.3vw,4.8rem)] font-black leading-[0.95] text-slate-950">Turn any room into a live quiz race.</h2>
        <p className="mt-3 max-w-4xl text-[clamp(1.05rem,1.5vw,1.55rem)] font-extrabold leading-tight text-slate-600">
          Everyone scans one QR, enters a topic, gets a private AI quiz, and races while the bracket moves live.
        </p>
        <div className="mt-3 grid max-w-4xl grid-cols-2 gap-3">
          <ProofPill label="Problem" value="Passive rooms are hard to measure." />
          <ProofPill label="Solution" value="Every answer, rank, bracket move, and scorecard syncs through SpacetimeDB." />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-slate-500">Racers joined</p>
          <motion.p key={joinedCount} initial={{ y: 10, opacity: 0.55 }} animate={{ y: 0, opacity: 1 }} className="text-6xl font-black leading-none text-slate-950">
            {joinedCount.toString().padStart(3, "0")}
          </motion.p>
        </div>
        <div className="grid gap-2 text-right">
          <button
            type="button"
            onClick={onStartRace}
            disabled={!canStartRace}
            className={cn(
              "inline-flex min-h-14 items-center justify-center gap-2 rounded-[24px] px-5 text-lg font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
              canStartRace
                ? "bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-100"
                : "bg-slate-100 text-slate-500"
            )}
          >
            <Play className="size-5" />
            {startLabel}
          </button>
          <span className="inline-flex items-center justify-end gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-base font-black text-white">
            <Clock className="size-5" />
            {statusText}
          </span>
          <span className="text-sm font-black text-slate-500">
            One QR. Custom quizzes. Live bracket. Shareable scorecards.
          </span>
        </div>
      </div>
    </Panel>
  );
}

function ProofPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black leading-snug text-slate-950">{value}</p>
    </div>
  );
}

function VisualRaceFlow({ phase, joinedCount, topicCount }: { phase: string; joinedCount: number; topicCount: number }) {
  const steps = [
    { label: "Scan", detail: joinedCount ? "joined" : "live", icon: UserPlus, state: joinedCount ? "complete" : "active" },
    { label: "Pick topic", detail: topicCount ? "picked" : "next", icon: MousePointerClick, state: topicCount || phase !== "lobby" ? "complete" : joinedCount ? "active" : "locked" },
    { label: "Build quiz", detail: "AI/cache", icon: Brain, state: phase === "generating" ? "active" : ["ready", "playing", "finished", "replay"].includes(phase) ? "complete" : "locked" },
    { label: "Race", detail: "phone", icon: TimerReset, state: phase === "playing" ? "active" : ["finished", "replay"].includes(phase) ? "complete" : phase === "ready" ? "active" : "locked" },
    { label: "Move bracket", detail: "live", icon: Trophy, state: phase === "playing" ? "active" : ["finished", "replay"].includes(phase) ? "complete" : "locked" },
    { label: "Share score", detail: "card", icon: Share2, state: ["finished", "replay"].includes(phase) ? "active" : "locked" }
  ] satisfies Array<{ label: string; detail: string; icon: React.ComponentType<{ className?: string }>; state: "active" | "complete" | "locked" }>;

  return (
    <Panel className="shrink-0 p-4">
      <div className="grid grid-cols-6 gap-3">
        {steps.map((step, index) => (
          <FlowStep key={step.label} step={step} showArrow={index < steps.length - 1} />
        ))}
      </div>
    </Panel>
  );
}

function FlowStep({
  step,
  showArrow
}: {
  step: { label: string; detail?: string; icon: React.ComponentType<{ className?: string }>; state: "active" | "complete" | "locked" };
  showArrow: boolean;
}) {
  const Icon = step.icon;
  const active = step.state === "active";
  const complete = step.state === "complete";
  return (
    <div className="relative">
      <motion.div
        animate={active ? { y: [0, -3, 0] } : { y: 0 }}
        transition={{ duration: 1.8, repeat: active ? Infinity : 0 }}
        className={cn(
          "flex min-h-[86px] items-center gap-3 rounded-[24px] px-4 py-3 ring-1",
          complete
            ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
            : active
              ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-200 ring-transparent"
              : "bg-slate-50 text-slate-400 ring-slate-200"
        )}
      >
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", active ? "bg-white/18" : complete ? "bg-white" : "bg-white")}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-black">{step.label}</p>
          <p className={cn("text-xs font-black uppercase", active ? "text-white/70" : complete ? "text-emerald-600" : "text-slate-400")}>
            {complete ? "ready" : active ? (step.detail ?? "live") : "locked"}
          </p>
        </div>
      </motion.div>
      {showArrow ? <ArrowRight className="absolute -right-5 top-1/2 z-10 size-7 -translate-y-1/2 rounded-full bg-white p-1 text-slate-300 shadow-sm" /> : null}
    </div>
  );
}

function RosterPreview({ participants, maxVisible = 24 }: { participants: Participant[]; maxVisible?: number }) {
  const visible = participants.slice(-maxVisible);
  const hidden = Math.max(0, participants.length - visible.length);
  return (
    <Panel className="flex min-h-0 flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Racers</h2>
          <p className="text-base font-extrabold text-slate-500">
            {participants.length ? "Live profiles from SpacetimeDB Participant rows." : "Waiting for racers to scan the QR."}
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">{participants.length} racers</span>
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-8 content-start gap-3">
        {visible.map((participant) => (
          <motion.div
            key={participant.participantId}
            layout
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: participant.championStatus === "eliminated" ? 0.45 : 1, scale: 1 }}
            className="min-w-0 text-center"
            title={`${participant.displayName} · ${participant.admissionStatus} · ${participant.championStatus}`}
          >
            <div
              className={cn(
                "mx-auto grid size-14 place-items-center rounded-full text-2xl font-black text-white shadow-lg ring-4",
                participant.championStatus === "eliminated"
                  ? "bg-slate-400 ring-slate-200"
                  : participant.admissionStatus === "admitted"
                    ? "bg-gradient-to-br from-violet-600 to-blue-600 ring-blue-100"
                    : "bg-gradient-to-br from-amber-400 to-orange-400 ring-amber-100"
              )}
            >
              {participant.avatar}
            </div>
            <p className="mt-1 truncate text-xs font-black text-slate-700">{participant.displayName}</p>
          </motion.div>
        ))}
        {!participants.length
          ? Array.from({ length: 16 }, (_, index) => (
              <motion.div
                key={index}
                animate={{ opacity: [0.36, 0.72, 0.36] }}
                transition={{ duration: 2.6, delay: index * 0.05, repeat: Infinity }}
                className="text-center"
              >
                <div className="mx-auto size-14 rounded-full border-2 border-dashed border-slate-300 bg-slate-50" />
                <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-slate-100" />
              </motion.div>
            ))
          : null}
        {hidden ? (
          <div className="grid size-14 place-items-center self-start rounded-full bg-slate-950 text-sm font-black text-white shadow-lg">+{hidden}</div>
        ) : null}
      </div>
    </Panel>
  );
}

function TopicBubbleSwarm({
  topicCounts,
  selectedTopic
}: {
  topicCounts: Array<{ topic: string; count: number; percent: number }>;
  selectedTopic?: string | null;
}) {
  const topics = topicCounts.length ? topicCounts.slice(0, 5) : DEFAULT_TOPICS.slice(0, 5).map((topic) => ({ topic, count: 0, percent: 0 }));
  return (
    <Panel className="min-h-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-black text-slate-950">Topics forming</h2>
        {selectedTopic ? <span className="max-w-[160px] truncate rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{selectedTopic}</span> : null}
      </div>
      <div className="mt-4 flex min-h-28 flex-wrap items-center gap-3">
        {topics.map((topic, index) => {
          const size = topic.count ? Math.max(84, Math.min(142, 72 + topic.percent * 1.1)) : 76 + index * 6;
          return (
            <motion.div
              key={topic.topic}
              animate={{ y: [0, index % 2 ? 4 : -4, 0] }}
              transition={{ duration: 4 + index * 0.35, repeat: Infinity }}
              className={cn(
                "grid shrink-0 place-items-center rounded-full text-center ring-1",
                topic.count ? "bg-gradient-to-br from-blue-50 to-violet-50 ring-blue-100" : "bg-slate-50 text-slate-400 ring-slate-200"
              )}
              style={{ width: size, height: size }}
            >
              <div className="px-2">
                <p className={cn("truncate text-sm font-black", topic.count ? "text-slate-950" : "text-slate-400")}>{topic.topic}</p>
                <p className="text-xs font-black text-slate-500">{topic.count ? `${topic.count} racer${topic.count === 1 ? "" : "s"}` : "example"}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      {!topicCounts.length ? <p className="mt-2 text-sm font-bold text-slate-500">Topics appear as racers enter what they want to quiz on.</p> : null}
    </Panel>
  );
}

function LiveJoinFeedCompact({ participants }: { participants: Participant[] }) {
  const visible = participants.slice(-4).reverse();
  if (!visible.length) return null;
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-950">Live joins</h2>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">live</span>
      </div>
      <div className="mt-3 grid gap-2">
        {visible.map((participant) => (
          <motion.div key={participant.participantId} initial={{ x: 12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-lg">{participant.avatar}</span>
            <span className="min-w-0 truncate text-sm font-black text-slate-900">{participant.displayName} joined</span>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

type AgentPipelineState = "pending" | "active" | "complete" | "fallback" | "failed" | "retrying";

export function LiveAgentBuildPipeline({
  participant,
  playerIntent,
  questionPack,
  questionCount,
  questionsReady,
  packSource,
  agentEvents,
  liveStats,
  connectionState
}: {
  participant: Participant;
  playerIntent?: PlayerIntent;
  questionPack?: QuestionPack;
  questionCount: number;
  questionsReady: boolean;
  packSource: string;
  agentEvents: AgentEvent[];
  liveStats?: LiveStats;
  connectionState: ConnectionState;
}) {
  const events = agentEvents.slice().sort((a, b) => b.createdAt - a.createdAt);
  const topic = playerIntent?.arenaName ?? questionPack?.displayTopic ?? "your topic";
  const sprintTitle = topic === "your topic" ? "Building your sprint" : `Building your ${topic} sprint`;
  const intentEvent = latestEvent(events, ["Intent Normalizer", "Topic Router Agent"], ["complete", "topic_selected"]);
  const hasIntent = Boolean(playerIntent) || Boolean(intentEvent) || Boolean(questionPack) || questionsReady;
  const hasPack = Boolean(questionPack) || questionsReady;
  const hasStoredQuestions = questionsReady;
  const connectionFailed = connectionState === "error" || connectionState === "disconnected";
  const fallbackPack = Boolean(questionPack?.sourceType && /fallback|seed/.test(questionPack.sourceType)) || /instant|fallback/i.test(packSource);
  const cachePack = Boolean(questionPack?.sourceType && /cache/.test(questionPack.sourceType)) || /cache/i.test(packSource);
  const researchEvent = latestEvent(events, ["Firecrawl Grounding Agent", "Instant Quiz Engine"], ["facts_ready", "facts_committed", "grounding_skipped", "instant_pack_ready"]);
  const builderEvent = latestEvent(events, ["Quiz Builder Agent"], ["generation_started", "questions_generated", "fallback_used", "template_grounded_fallback_used"]);
  const fairnessEvent = latestEvent(events, ["Fairness Agent"], ["questions_approved", "fallback_approved"]);
  const syncEvent = latestEvent(events, ["Match Engine"], ["questions_ready"]);

  const steps: Array<{
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    state: AgentPipelineState;
    message: string;
    badge?: string;
    durationMs?: number | null;
  }> = [
    {
      id: "intent",
      title: "Intent Agent",
      icon: Radar,
      state: hasIntent ? "complete" : "active",
      message: playerIntent ? `Parsed "${playerIntent.rawText}" into ${topic}.` : intentEvent?.content ?? (hasIntent ? `Parsed topic into ${topic}.` : "Understanding your topic..."),
      durationMs: playerIntent ? Math.max(0, playerIntent.updatedAt - playerIntent.createdAt) : null
    },
    {
      id: "research",
      title: "Research Agent",
      icon: Globe2,
      state: !hasIntent ? "pending" : researchState(researchEvent, hasPack, fallbackPack || cachePack),
      message:
        researchEvent?.content ??
        (hasPack
          ? cachePack || fallbackPack
            ? `Using ${packSource.toLowerCase()}.`
            : `Research complete for ${topic}.`
          : "Checking cache and Firecrawl facts..."),
      badge: cachePack ? "cache" : fallbackPack ? "fallback" : undefined,
      durationMs: durationSinceIntent(playerIntent, researchEvent)
    },
    {
      id: "builder",
      title: "Quiz Builder",
      icon: Brain,
      state: !hasIntent ? "pending" : hasPack ? (fallbackPack ? "fallback" : "complete") : builderEvent?.status === "failed" ? "failed" : "active",
      message: hasPack ? `Built ${questionCount} MCQs for ${topic}.` : builderEvent?.content ?? "Creating answer options...",
      badge: questionPack?.sourceType ? sourceTypeLabel(questionPack.sourceType) : undefined,
      durationMs: durationSinceIntent(playerIntent, builderEvent)
    },
    {
      id: "fairness",
      title: "Fairness Guard",
      icon: ShieldCheck,
      state: !hasIntent ? "pending" : hasPack ? (fallbackPack ? "fallback" : "complete") : fairnessEvent?.status === "failed" ? "failed" : "pending",
      message: fairnessEvent?.content ?? (hasPack ? "Validated option uniqueness and answer schema." : "Waiting for generated questions..."),
      badge: fallbackPack ? "safe fallback" : undefined,
      durationMs: durationSinceIntent(playerIntent, fairnessEvent)
    },
    {
      id: "sync",
      title: "SpacetimeDB Sync",
      icon: Database,
      state: connectionFailed ? "retrying" : hasStoredQuestions ? "complete" : hasPack ? "active" : "pending",
      message: connectionFailed
        ? "Reconnecting to the realtime database..."
        : hasStoredQuestions
          ? "QuestionPack stored. Phone subscribed."
          : hasPack
            ? "Waiting for QuestionPublic rows..."
            : "Reducer will store the pack before cards render.",
      badge: `${liveStats?.reducerCalls ?? 0} commits`,
      durationMs: durationSinceIntent(playerIntent, syncEvent)
    },
    {
      id: "ready",
      title: "Ready",
      icon: Flag,
      state: hasStoredQuestions ? "complete" : "pending",
      message: hasStoredQuestions ? "Watch the projector countdown." : "Your sprint will unlock as soon as the pack syncs.",
      badge: hasStoredQuestions ? "race ready" : undefined
    }
  ];

  return (
    <div className="rounded-[30px] bg-gradient-to-br from-slate-950 to-[#10194a] p-4 text-white shadow-2xl shadow-violet-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-blue-200">Live build pipeline</p>
          <h2 className="mt-1 text-2xl font-black leading-tight">{sprintTitle}</h2>
        </div>
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-2xl">{participant.avatar}</div>
      </div>
      <div className="mt-4 space-y-2.5">
        {steps.map((step, index) => (
          <AgentPipelineStep key={step.id} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}

function AgentPipelineStep({
  step,
  index
}: {
  step: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    state: AgentPipelineState;
    message: string;
    badge?: string;
    durationMs?: number | null;
  };
  index: number;
}) {
  const Icon = step.icon;
  const active = step.state === "active" || step.state === "retrying";
  const complete = step.state === "complete" || step.state === "fallback";
  const failed = step.state === "failed";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: step.state === "pending" ? 0.58 : 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      className={cn(
        "flex items-center gap-3 rounded-[22px] px-3 py-3 ring-1",
        failed
          ? "bg-rose-500/14 ring-rose-300/20"
          : step.state === "fallback"
            ? "bg-amber-400/14 ring-amber-300/25"
            : complete
              ? "bg-emerald-400/12 ring-emerald-300/20"
              : active
                ? "bg-white/12 ring-blue-200/25"
                : "bg-white/7 ring-white/10"
      )}
    >
      <motion.span
        animate={active ? { scale: [1, 1.08, 1], boxShadow: ["0 0 0 0 rgba(96,165,250,0.28)", "0 0 0 10px rgba(96,165,250,0)", "0 0 0 0 rgba(96,165,250,0)"] } : {}}
        transition={{ duration: 1.5, repeat: active ? Infinity : 0 }}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl",
          failed ? "bg-rose-500 text-white" : complete ? "bg-white text-emerald-600" : active ? "bg-blue-500 text-white" : "bg-white/10 text-white/55"
        )}
      >
        {active ? <Loader2 className="size-5 animate-spin" /> : failed ? <CircleAlert className="size-5" /> : complete ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
      </motion.span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-black">{step.title}</p>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase", pipelineBadgeClass(step.state))}>{step.state}</span>
          {step.badge ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-blue-100">{step.badge}</span> : null}
          {typeof step.durationMs === "number" ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-white/70">{formatDuration(step.durationMs)}</span> : null}
        </div>
        <p className="mt-0.5 truncate text-sm font-bold text-white/68">{step.message}</p>
      </div>
    </motion.div>
  );
}

function latestEvent(events: AgentEvent[], agentNames: string[], eventTypes?: string[]): AgentEvent | undefined {
  return events.find((event) => agentNames.includes(event.agentName) && (!eventTypes || eventTypes.includes(event.eventType)));
}

function researchState(event: AgentEvent | undefined, hasPack: boolean, degraded: boolean): AgentPipelineState {
  if (event?.status === "failed") return "failed";
  if (event?.status === "fallback" || degraded) return "fallback";
  if (event?.status === "complete" || hasPack) return "complete";
  return "active";
}

function durationSinceIntent(playerIntent: PlayerIntent | undefined, event: AgentEvent | undefined): number | null {
  if (!playerIntent || !event) return null;
  return Math.max(0, event.createdAt - playerIntent.createdAt);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function sourceTypeLabel(sourceType: QuestionPack["sourceType"]): string {
  return sourceType.replace(/_/g, " ");
}

function pipelineBadgeClass(state: AgentPipelineState): string {
  if (state === "complete") return "bg-emerald-400/20 text-emerald-100";
  if (state === "fallback") return "bg-amber-300/20 text-amber-100";
  if (state === "failed") return "bg-rose-300/20 text-rose-100";
  if (state === "active" || state === "retrying") return "bg-blue-300/20 text-blue-100";
  return "bg-white/10 text-white/50";
}

export function RoomRosterBand({ participants }: { participants: Participant[] }) {
  const admitted = participants.filter((participant) => participant.admissionStatus === "admitted").length;
  const waitlisted = participants.filter((participant) => participant.admissionStatus !== "admitted").length;
  const visible = participants.slice(0, 180);
  const hidden = Math.max(0, participants.length - visible.length);

  return (
    <Panel className="shrink-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Room Roster</h2>
          <p className="text-sm font-extrabold text-slate-500">{participants.length} tracked · {admitted} racing · {waitlisted} queued/watching</p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">live profiles</span>
      </div>
      <div className="mt-3 grid max-h-32 grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 overflow-y-auto pr-1">
        {visible.map((participant) => (
          <motion.div
            key={participant.participantId}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: participant.championStatus === "eliminated" ? 0.5 : 1, scale: 1 }}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 ring-1",
              participant.championStatus === "champion"
                ? "bg-amber-50 ring-amber-200"
                : participant.championStatus === "eliminated"
                  ? "bg-slate-100 ring-slate-200"
                  : participant.admissionStatus === "admitted"
                    ? "bg-blue-50 ring-blue-100"
                    : "bg-white ring-slate-200"
            )}
            title={`${participant.displayName} · ${participant.admissionStatus} · ${participant.championStatus}`}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-base",
                participant.championStatus === "eliminated" ? "bg-slate-300 grayscale" : "bg-gradient-to-br from-blue-600 to-violet-600"
              )}
            >
              {participant.avatar}
            </span>
            <span className="min-w-0 truncate text-xs font-black text-slate-950">{participant.displayName}</span>
          </motion.div>
        ))}
        {hidden ? (
          <div className="flex items-center justify-center rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white">+{hidden} more</div>
        ) : null}
        {!participants.length ? <p className="text-sm font-bold text-slate-500">Waiting for profiles...</p> : null}
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
    <Panel className="flex min-h-[560px] flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-blue-100 px-4 py-2.5 text-lg font-black text-blue-700">
            Question {round?.orderIndex ?? 0} / {QUESTION_COUNT}
          </div>
          <div className="rounded-full bg-slate-950 px-4 py-2.5 text-lg font-black text-white">
            Race clock {raceSecondsRemaining}s
          </div>
        </div>
        <TimerRing secondsRemaining={secondsRemaining} />
      </div>
      <h2 className="mt-6 text-5xl font-black leading-tight text-slate-950">{question?.questionText ?? "Waiting for the agent-built question pack..."}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {options.map(([key, value]) => (
          <div key={key} className="rounded-[22px] border-2 border-slate-200 bg-slate-50 p-4 text-2xl font-black text-slate-900">
            <span className="mr-3 inline-grid size-10 place-items-center rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-lg text-white">{key}</span>
            {value}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-[24px] bg-slate-950 px-6 py-4 text-2xl font-black text-white">
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
      className={cn("grid size-22 place-items-center rounded-full text-4xl font-black text-white", urgent ? "bg-gradient-to-r from-rose-500 to-red-500" : "bg-gradient-to-r from-amber-400 to-orange-400")}
    >
      {Math.max(0, secondsRemaining)}
    </motion.div>
  );
}

export function LeaderboardPanel({ entries, compact = false }: { entries: Array<{ participant: Participant; score: Score }>; compact?: boolean }) {
  return (
    <Panel className={compact ? "min-h-[360px]" : "min-h-full"}>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-950">Leaderboard</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">speed + accuracy</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {entries.slice(0, compact ? 12 : 20).map((entry, index) => {
          const displayRank = index + 1;
          return (
          <motion.div
            key={entry.participant.participantId}
            layout
            className={cn(
              "flex items-center gap-3 rounded-[20px] px-3 py-2.5",
              displayRank === 1 ? "bg-gradient-to-r from-amber-100 to-orange-100 ring-2 ring-amber-300" : "bg-slate-50"
            )}
          >
            <span className="w-10 text-xl font-black text-slate-500">#{displayRank}</span>
            <Avatar participant={entry.participant} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{entry.participant.displayName}</p>
              <p className="text-sm font-bold text-slate-500">{entry.score.correctCount}/{QUESTION_COUNT} correct</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-950">{entry.score.totalScore.toLocaleString()}</p>
              <p className={cn("text-sm font-black", leaderboardStatusClass(entry))}>
                {leaderboardStatus(entry)}
              </p>
            </div>
          </motion.div>
          );
        })}
        {!entries.length ? <p className="text-lg font-bold text-slate-500">Scores appear after the first answer.</p> : null}
      </div>
    </Panel>
  );
}

function leaderboardStatus(entry: { participant: Participant; score: Score }): string {
  if (entry.participant.championStatus === "champion" || entry.score.championStatus === "champion") return "champion";
  if (entry.participant.championStatus === "eliminated" || entry.score.championStatus === "eliminated") return "out";
  if (entry.participant.admissionStatus === "waitlisted") return "queued";
  if (entry.participant.admissionStatus === "spectator") return "watching";
  if (entry.score.previousRank > entry.score.currentRank) return `up ${entry.score.previousRank - entry.score.currentRank}`;
  return "live";
}

function leaderboardStatusClass(entry: { participant: Participant; score: Score }): string {
  const status = leaderboardStatus(entry);
  if (status === "champion") return "text-amber-600";
  if (status === "out") return "text-slate-400";
  if (status === "queued" || status === "watching") return "text-amber-700";
  if (status.startsWith("up")) return "text-emerald-600";
  return "text-slate-400";
}

export function TechMetricStrip({ stats, eventsCount }: { stats?: LiveStats; eventsCount: number }) {
  return (
    <div className="grid grid-cols-6 gap-3 rounded-[24px] bg-slate-950 p-3 text-white">
      <MetricStripItem label="answers/sec" value={stats?.answersPerSec ?? 0} />
      <MetricStripItem label="reducer calls" value={stats?.reducerCalls ?? 0} />
      <MetricStripItem label="events" value={eventsCount} />
      <MetricStripItem label="duplicate taps" value={stats?.duplicateAnswersRejected ?? 0} />
      <MetricStripItem label="measured p95" value={`${stats?.p95LatencyMs ?? 48}ms`} />
      <MetricStripItem label="admitted" value={stats?.admittedRacers ?? 0} />
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

export function TechDrawer({
  open,
  onClose,
  stats,
  events,
  participants,
  session,
  state,
  clientErrors
}: {
  open: boolean;
  onClose: () => void;
  stats?: LiveStats;
  events: MatchEvent[];
  participants: Participant[];
  session?: Session;
  state?: QuizRushState;
  clientErrors?: ClientError[];
}) {
  const [activeTab, setActiveTab] = React.useState<"overview" | "flow" | "metrics" | "diagnostics" | "scoring" | "tables" | "ledger">("overview");
  if (!open) return null;
  const recentEvents = events.slice(-18).reverse();
  const recentClientErrors = (clientErrors ?? []).slice(-10).reverse();
  const activeRacers = participants.filter((participant) => participant.admissionStatus === "admitted" && participant.championStatus === "active").length;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "flow", label: "Flow" },
    { id: "metrics", label: "Metrics" },
    { id: "diagnostics", label: "Diagnostics" },
    { id: "scoring", label: "Scoring" },
    { id: "tables", label: "Tables" },
    { id: "ledger", label: "Ledger" }
  ] as const;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[520px] overflow-y-auto bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/25"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-violet-700">Technical details</p>
            <h2 className="text-3xl font-black">Realtime race engine</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-700" aria-label="Close technical drawer">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-sm font-black transition",
                activeTab === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <TechOverview stats={stats} session={session} activeRacers={activeRacers} participants={participants} />
        ) : null}
        {activeTab === "flow" ? <TechFlow /> : null}
        {activeTab === "metrics" ? <TechMetrics stats={stats} session={session} activeRacers={activeRacers} /> : null}
        {activeTab === "diagnostics" ? <TechDiagnostics state={state} session={session} participants={participants} clientErrors={recentClientErrors} /> : null}
        {activeTab === "scoring" ? <TechScoring /> : null}
        {activeTab === "tables" ? <TechTables /> : null}
        {activeTab === "ledger" ? (
          <TechLedger recentEvents={recentEvents} recentClientErrors={recentClientErrors} participants={participants} />
        ) : null}
      </aside>
    </div>
  );
}

function TechOverview({
  stats,
  session,
  activeRacers,
  participants
}: {
  stats?: LiveStats;
  session?: Session;
  activeRacers: number;
  participants: Participant[];
}) {
  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MetricWithHelp
          label="p95 answer commit"
          value={`${stats?.p95AnswerCommitMs || stats?.p95LatencyMs || 0}ms`}
          formula="95th percentile of answer reducer commit latency."
          explanation="Measures how quickly answer actions become authoritative state."
          sourceTable="Answer, LiveStats"
          sourceReducer="submit_answer"
        />
        <MetricWithHelp
          label="p95 sync render"
          value={`${stats?.p95SubscriptionRenderMs ?? 0}ms`}
          formula="Client render time minus committed update time."
          explanation="Shows how quickly subscribed table updates reach the screen."
          sourceTable="LiveStats"
          sourceReducer="live_tick"
        />
        <MetricWithHelp
          label="active racers"
          value={activeRacers}
          formula="Admitted participants still on the Champion Path."
          explanation="Waitlisted users stay tracked but do not overload the active sprint."
          sourceTable="Participant"
          sourceReducer="join_session"
        />
        <MetricWithHelp
          label="capacity"
          value={`${session?.admittedCount ?? stats?.admittedRacers ?? 0}/${session?.maxRacers ?? 12}`}
          formula="Admitted racers divided by tested hard cap."
          explanation="Admission control protects realtime performance under load."
          sourceTable="SessionCapacity"
          sourceReducer="join_session"
        />
      </div>
      <SystemFlowDiagram />
      <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-600 ring-1 ring-slate-200">
        Phones call reducers; SpacetimeDB commits scores and bracket state; screens subscribe to updates. Current room state tracks {participants.length} profiles.
      </p>
    </div>
  );
}

function SystemFlowDiagram() {
  const nodes = [
    { label: "Phones", icon: Smartphone },
    { label: "Reducers", icon: Layers3 },
    { label: "SpacetimeDB", icon: Database },
    { label: "Subscriptions", icon: RadioTower },
    { label: "Projector", icon: Trophy },
    { label: "ShareCard", icon: Share2 }
  ];
  return (
    <div className="rounded-[24px] bg-slate-950 p-4 text-white">
      <div className="grid grid-cols-3 gap-3">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="relative rounded-2xl bg-white/10 p-3">
              <Icon className="size-6 text-blue-200" />
              <p className="mt-2 text-sm font-black">{node.label}</p>
              {index < nodes.length - 1 ? <ArrowRight className="absolute -right-4 top-1/2 size-6 -translate-y-1/2 rounded-full bg-slate-950 p-1 text-blue-200" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TechFlow() {
  const steps = [
    { label: "Phone tap", detail: "Player selects an option.", icon: MousePointerClick },
    { label: "submit_answer", detail: "Reducer checks round, duplicate taps, hidden answer, and server time.", icon: Layers3 },
    { label: "Score + bracket rows", detail: "Answer, Score, Leaderboard, and MatchEvent commit together.", icon: Database },
    { label: "Projector subscription", detail: "Bracket and leaderboard render committed state.", icon: RadioTower },
    { label: "Share score", detail: "ShareCard reducer creates a durable public slug.", icon: Share2 }
  ];
  return (
    <div className="mt-5 space-y-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white">
                <Icon className="size-5" />
              </div>
              {index < steps.length - 1 ? <div className="h-8 w-px bg-slate-200" /> : null}
            </div>
            <div className="flex-1 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-base font-black text-slate-950">{step.label}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">{step.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TechMetrics({ stats, session, activeRacers }: { stats?: LiveStats; session?: Session; activeRacers: number }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <MetricWithHelp
        label="answers/sec"
        value={stats?.answersPerSec ?? 0}
        formula="Recent committed answers per second."
        explanation="Indicates live room answer throughput."
        sourceTable="Answer, LiveStats"
        sourceReducer="submit_answer"
      />
      <MetricWithHelp
        label="realtime commits"
        value={stats?.reducerCalls ?? 0}
        formula="Reducer calls recorded for the session."
        explanation="Each important game action goes through a reducer."
        sourceTable="OperationTrace, LiveStats"
        sourceReducer="all reducers"
      />
      <MetricWithHelp
        label="double taps blocked"
        value={stats?.duplicateAnswersRejected ?? 0}
        formula="Rejected duplicate answers for participant plus round."
        explanation="Proves retry/double-tap protection is active."
        sourceTable="Answer, LiveStats"
        sourceReducer="submit_answer"
      />
      <MetricWithHelp
        label="capacity used"
        value={`${activeRacers}/${session?.maxRacers ?? 12}`}
        formula="Active admitted racers over current hard cap."
        explanation="Overflow users stay visible in the roster without overwhelming the race."
        sourceTable="Session, Participant"
        sourceReducer="join_session"
      />
      <MetricWithHelp
        label="quiz pack ready p95"
        value="cache-first"
        formula="Cache or fallback pack availability before LLM refinement."
        explanation="The demo keeps moving even when external AI providers are slow."
        sourceTable="QuestionPack, AgentEvent"
        sourceReducer="submit_question_pack"
      />
      <MetricWithHelp
        label="client errors"
        value={stats?.capacityStatus ?? "open"}
        formula="Capacity state and error recovery status."
        explanation="Degraded state locks admissions before realtime performance collapses."
        sourceTable="ClientError, SessionCapacity"
        sourceReducer="record_client_error"
      />
    </div>
  );
}

function TechDiagnostics({
  state,
  session,
  participants,
  clientErrors
}: {
  state?: QuizRushState;
  session?: Session;
  participants: Participant[];
  clientErrors: ClientError[];
}) {
  const sessionId = session?.sessionId;
  const participantIds = new Set(participants.map((participant) => participant.participantId));
  const scoped = {
    admissionTickets: state?.admissionTickets.filter((row) => row.sessionId === sessionId) ?? [],
    playerIntents: state?.playerIntents.filter((row) => row.sessionId === sessionId) ?? [],
    agentRequests: state?.agentRequests.filter((row) => row.sessionId === sessionId) ?? [],
    questionPacks: state?.questionPacks.filter((row) => row.sessionId === sessionId) ?? [],
    questions: state?.questions.filter((row) => row.sessionId === sessionId) ?? [],
    rounds: state?.rounds.filter((row) => row.sessionId === sessionId) ?? [],
    answers: state?.answers.filter((row) => row.sessionId === sessionId) ?? [],
    scores: state?.scores.filter((row) => row.sessionId === sessionId) ?? [],
    finalResults: state?.finalResults.filter((row) => row.sessionId === sessionId) ?? [],
    shareCards: state?.shareCards.filter((row) => row.sessionId === sessionId) ?? [],
    reducerFailures: state?.operationTraces.filter((row) => row.sessionId === sessionId && !row.ok).slice(-8).reverse() ?? []
  };
  const participantPacks = scoped.questionPacks.filter((pack) => pack.participantId && participantIds.has(pack.participantId));
  const roomPacks = scoped.questionPacks.filter((pack) => !pack.participantId);

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-[24px] bg-slate-950 p-4 text-white">
        <p className="text-xs font-black uppercase text-blue-200">Production realtime target</p>
        <p className="mt-2 break-all text-sm font-black">Session: {session?.code ?? "missing"} · {session?.status ?? "unknown"}</p>
        <p className="mt-1 text-sm font-bold text-slate-300">Open the terminal command: make diagnose SESSION={session?.code ?? "ARENA-42"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DiagnosticCount label="Participant rows" value={participants.length} />
        <DiagnosticCount label="Admission tickets" value={scoped.admissionTickets.length} />
        <DiagnosticCount label="Player intents" value={scoped.playerIntents.length} />
        <DiagnosticCount label="Generation jobs" value={scoped.agentRequests.length} />
        <DiagnosticCount label="Private packs" value={participantPacks.length} />
        <DiagnosticCount label="Room packs" value={roomPacks.length} />
        <DiagnosticCount label="Questions" value={scoped.questions.length} />
        <DiagnosticCount label="Rounds" value={scoped.rounds.length} />
        <DiagnosticCount label="Answers" value={scoped.answers.length} />
        <DiagnosticCount label="Scores" value={scoped.scores.length} />
        <DiagnosticCount label="Final results" value={scoped.finalResults.length} />
        <DiagnosticCount label="Share cards" value={scoped.shareCards.length} />
      </div>
      <TechSection title="Recent reducer failures">
        <div className="space-y-2">
          {scoped.reducerFailures.map((failure) => (
            <div key={failure.traceId} className="rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100">
              <p className="text-sm font-black text-rose-900">{failure.reducer}</p>
              <p className="mt-1 text-xs font-bold text-rose-700">{failure.errorMessage ?? "No reducer error message stored."}</p>
            </div>
          ))}
          {!scoped.reducerFailures.length ? <p className="text-sm font-bold text-slate-500">No reducer failures recorded for this session.</p> : null}
        </div>
      </TechSection>
      <TechSection title="Recent phone errors">
        <div className="space-y-2">
          {clientErrors.map((error) => (
            <div key={error.errorId} className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
              <p className="text-sm font-black text-amber-900">{error.screen} · {error.errorCode}</p>
              <p className="mt-1 text-xs font-bold text-amber-700">{error.message}</p>
            </div>
          ))}
          {!clientErrors.length ? <p className="text-sm font-bold text-slate-500">No phone recovery errors recorded.</p> : null}
        </div>
      </TechSection>
    </div>
  );
}

function DiagnosticCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function TechScoring() {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[24px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <div className="flex items-center gap-3">
          <Award className="size-7 text-emerald-700" />
          <h3 className="text-xl font-black text-emerald-950">Correct answer</h3>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <ScoreChip label="base" value="+1000" />
          <ScoreChip label="speed" value="+0..1000" />
          <ScoreChip label="streak" value="+100" />
        </div>
      </div>
      <div className="rounded-[24px] bg-rose-50 p-4 ring-1 ring-rose-100">
        <div className="flex items-center gap-3">
          <X className="size-7 text-rose-700" />
          <h3 className="text-xl font-black text-rose-950">Wrong answer</h3>
        </div>
        <p className="mt-3 text-lg font-black text-rose-900">0 points. Wrong answers never receive speed bonus.</p>
      </div>
      <div className="rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <Crown className="size-7 text-amber-600" />
          <h3 className="text-xl font-black text-slate-950">Rank comparator</h3>
        </div>
        <div className="mt-3 grid gap-2">
          {["score high", "correct count high", "total time low", "fastest answer low", "last answer earlier"].map((item) => (
            <div key={item} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-emerald-100">
      <p className="text-xs font-black uppercase text-emerald-700">{label}</p>
      <p className="mt-1 text-xl font-black text-emerald-950">{value}</p>
    </div>
  );
}

function TechTables() {
  const groups = [
    { label: "Game", icon: Trophy, tables: ["Session", "Participant", "Score", "FinalResult"] },
    { label: "Quiz", icon: Brain, tables: ["PlayerIntent", "QuestionPack", "QuestionPublic", "QuestionSecret"] },
    { label: "Realtime", icon: RadioTower, tables: ["BracketNode", "LeaderboardTopN", "LiveStats", "MatchEvent"] },
    { label: "Share", icon: Share2, tables: ["ShareCard"] }
  ];
  return (
    <div className="mt-5 space-y-4">
      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.label} className="rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <Icon className="size-5 text-blue-700" />
              <h3 className="text-lg font-black text-slate-950">{group.label}</h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.tables.map((table) => (
                <span key={table} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                  <Table2 className="size-4 text-slate-400" />
                  {table}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TechLedger({
  recentEvents,
  recentClientErrors,
  participants
}: {
  recentEvents: MatchEvent[];
  recentClientErrors: ClientError[];
  participants: Participant[];
}) {
  return (
    <div className="mt-5 space-y-5">
      <TechSection title="Client Error Recovery">
        <div className="space-y-2">
          {recentClientErrors.map((error) => (
            <details key={error.errorId} className="rounded-2xl bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
              <summary className="cursor-pointer text-sm font-black text-rose-900">
                {error.screen} · {error.errorCode} · {error.stackHash ?? "no hash"}
              </summary>
              <p className="mt-2 text-sm font-bold text-rose-800">{error.message}</p>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs font-bold text-slate-600">
                {JSON.stringify(error.metadata, null, 2)}
              </pre>
            </details>
          ))}
          {!recentClientErrors.length ? <p className="text-sm font-bold text-slate-500">No phone or projector client errors recorded for this session.</p> : null}
        </div>
      </TechSection>
      <TechSection title="MatchEvent Ledger">
        <div className="space-y-2">
          {recentEvents.map((event) => {
            const participant = participants.find((candidate) => candidate.participantId === event.participantId);
            return (
              <details key={event.eventId} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <summary className="cursor-pointer text-sm font-black text-slate-800">
                  {formatEventLabel(event.eventType)} · {participant?.displayName ?? "system"} · {event.rankAfter ? `#${event.rankAfter}` : "ledger"}
                </summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs font-bold text-slate-600">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </details>
            );
          })}
          {!recentEvents.length ? <p className="text-sm font-bold text-slate-500">Ledger rows appear after reducers commit activity.</p> : null}
        </div>
      </TechSection>
    </div>
  );
}

function formatEventLabel(value: string) {
  return value.replaceAll("_", " ");
}

function MetricWithHelp({
  label,
  value,
  formula,
  explanation,
  sourceTable,
  sourceReducer
}: {
  label: string;
  value: React.ReactNode;
  formula: string;
  explanation: string;
  sourceTable: string;
  sourceReducer: string;
}) {
  const help = `${formula} ${explanation} Source: ${sourceTable}. Reducer: ${sourceReducer}. SpacetimeDB reducers commit related table updates transactionally.`;
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase text-slate-500">{label}</p>
        <span title={help} aria-label={help} className="inline-grid size-6 place-items-center rounded-full text-slate-400">
          <HelpCircle className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-bold leading-snug text-slate-500">{sourceTable}</p>
    </div>
  );
}

function TechSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
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
  onClick,
  disabled = false
}: {
  optionKey: OptionKey;
  text: string;
  state: "idle" | "locked" | "correct" | "wrong";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state !== "idle"}
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
