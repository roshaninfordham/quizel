import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  Bot,
  Check,
  CircleAlert,
  Clock,
  Heart,
  Loader2,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  Zap
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DISCLAIMER, QUESTION_TIME_LIMIT_MS, supportAccuracyPercent, type AgentEvent, type Participant, type Score } from "@quizduel/shared";
import type { ConnectionState } from "../lib/spacetime/client";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">{children}</div>
      <Footer />
    </main>
  );
}

export function ProjectorShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="projector-grid min-h-screen overflow-hidden px-8 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[1720px] flex-col gap-5">{children}</div>
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
    <p className={cn("mx-auto mt-5 max-w-5xl text-center font-semibold text-slate-500", compact ? "text-[11px]" : "text-xs")}>
      {DISCLAIMER}
    </p>
  );
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
    primary: "bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700",
    secondary: "bg-white text-slate-950 ring-1 ring-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-white/70",
    danger: "bg-rose-500 text-white shadow-lg shadow-rose-100 hover:bg-rose-600",
    success: "bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition active:scale-[0.98] disabled:opacity-50",
        styles[variant],
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function IconPill({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "mango" | "mint" | "aqua" | "coral" }) {
  const tones = {
    violet: "bg-violet-100 text-violet-700",
    mango: "bg-amber-100 text-amber-700",
    mint: "bg-emerald-100 text-emerald-700",
    aqua: "bg-cyan-100 text-cyan-700",
    coral: "bg-rose-100 text-rose-700"
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold", tones[tone])}>{children}</span>;
}

export function Panel({
  children,
  className,
  accent
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "violet" | "mango" | "mint" | "aqua" | "coral";
}) {
  const accents = {
    violet: "border-t-violet-500",
    mango: "border-t-amber-400",
    mint: "border-t-emerald-400",
    aqua: "border-t-cyan-400",
    coral: "border-t-rose-400"
  };
  return (
    <section
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-5 shadow-sm",
        accent ? `border-t-4 ${accents[accent]}` : "",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "violet",
  icon
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: "violet" | "mango" | "mint" | "aqua" | "coral" | "blue";
  icon?: React.ReactNode;
}) {
  const tones = {
    violet: "bg-violet-50 text-violet-700",
    mango: "bg-amber-50 text-amber-700",
    mint: "bg-emerald-50 text-emerald-700",
    aqua: "bg-cyan-50 text-cyan-700",
    coral: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700"
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold uppercase text-slate-500">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-lg", tones[tone])}>{icon ?? <Sparkles className="size-5" />}</span>
      </div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
      {detail ? <p className="mt-1 text-sm font-bold text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function ConnectionBadge({
  state,
  lastSyncAt
}: {
  state: ConnectionState;
  lastSyncAt: number | null;
}) {
  const connected = state === "connected";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold",
        connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      )}
    >
      {connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
      <span>{connected ? "Realtime connected" : state === "error" ? "Local fallback" : "Reconnecting"}</span>
      <span className="text-slate-500">{lastSyncAt ? `${Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s` : ""}</span>
    </div>
  );
}

export function ReconnectingBanner({ state }: { state: ConnectionState }) {
  if (state === "connected") return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
      Reconnecting to the laptop realtime server. This screen will keep using local demo state until the connection returns.
    </div>
  );
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg bg-slate-100 p-1 sm:grid-flow-col">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 rounded-md px-4 text-sm font-extrabold transition",
            value === option.value ? "bg-white text-violet-700 shadow-sm" : "text-slate-600 hover:bg-white/60"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ participant, size = "md" }: { participant?: Participant; size?: "sm" | "md" | "lg" | "xl" }) {
  const initials = (participant?.displayName ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizes = {
    sm: "size-9 text-sm",
    md: "size-12 text-base",
    lg: "size-16 text-xl",
    xl: "size-24 text-4xl"
  };
  const colors = ["bg-violet-500", "bg-cyan-500", "bg-amber-400", "bg-emerald-500", "bg-rose-500", "bg-blue-600"];
  const index = participant ? participant.avatarSeed.length % colors.length : 0;
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-lg font-black text-white shadow-sm", sizes[size], colors[index])}>
      {initials}
    </div>
  );
}

export function PlayerCard({
  participant,
  score,
  support = 0,
  side,
  active
}: {
  participant?: Participant;
  score?: Score;
  support?: number;
  side?: string;
  active?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-white p-4 shadow-sm", active ? "border-violet-400 ring-4 ring-violet-100" : "border-slate-200")}>
      <div className="flex items-center gap-3">
        <Avatar participant={participant} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase text-slate-500">{side ?? "Champion"}</p>
          <h3 className="truncate text-xl font-black text-slate-950">{participant?.displayName ?? "Waiting"}</h3>
          <p className="text-sm font-bold text-slate-500">{participant?.isSimulated ? "Simulated supporter" : "Live device"}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricMini label="Score" value={score?.playerScore ?? 0} />
        <MetricMini label="Support" value={support} suffix=" Energy" />
      </div>
    </div>
  );
}

export function MetricMini({ label, value, suffix = "" }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs font-extrabold uppercase text-slate-500">{label}</p>
      <p className="text-lg font-black text-slate-950">
        {value}
        <span className="text-xs font-bold text-slate-500">{suffix}</span>
      </p>
    </div>
  );
}

export function SupportBar({ leftLabel, rightLabel, leftValue, rightValue }: { leftLabel: string; rightLabel: string; leftValue: number; rightValue: number }) {
  const total = Math.max(1, leftValue + rightValue);
  const leftPct = Math.round((leftValue / total) * 100);
  const rightPct = 100 - leftPct;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-extrabold text-slate-700">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-slate-100">
        <div className="bg-violet-500 transition-all" style={{ width: `${leftPct}%` }} />
        <div className="bg-cyan-400 transition-all" style={{ width: `${rightPct}%` }} />
      </div>
      <div className="flex justify-between text-xs font-bold text-slate-500">
        <span>{leftValue} Energy</span>
        <span>{rightValue} Energy</span>
      </div>
    </div>
  );
}

export function TimerRing({ startsAt, endsAt, status }: { startsAt?: number; endsAt?: number; status?: string }) {
  const now = useNow(250);
  const remaining = startsAt && endsAt ? Math.max(0, endsAt - now) : 0;
  const pct = startsAt && endsAt ? Math.max(0, Math.min(100, (remaining / Math.max(1, endsAt - startsAt)) * 100)) : 0;
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div
      className="grid size-24 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#8B5CF6 ${pct}%, #E5E7EB ${pct}% 100%)`
      }}
    >
      <div className="grid size-20 place-items-center rounded-full bg-white">
        <Clock className={cn("size-5 text-violet-600", status === "active" && remaining < 3000 ? "animate-pulse" : "")} />
        <span className="text-2xl font-black text-slate-950">{seconds}</span>
      </div>
    </div>
  );
}

export function AnswerButton({
  label,
  text,
  selected,
  correct,
  wrong,
  disabled,
  onClick
}: {
  label: string;
  text: string;
  selected?: boolean;
  correct?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-center gap-4 rounded-lg border-2 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] disabled:cursor-default",
        selected ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300",
        correct ? "border-emerald-500 bg-emerald-50" : "",
        wrong ? "border-rose-500 bg-rose-50" : ""
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-lg font-black text-white">{label}</span>
      <span className="text-base font-extrabold leading-snug text-slate-950">{text}</span>
      {selected ? <Check className="ml-auto size-5 shrink-0 text-violet-600" /> : null}
    </button>
  );
}

export function CheerButton({ playerName, disabled, onClick }: { playerName: string; disabled?: boolean; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="secondary"
      icon={<Heart className="size-5 fill-rose-400 text-rose-500" />}
      className="w-full justify-center border-2 border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100"
    >
      Cheer +25 for {playerName}
    </Button>
  );
}

export function LiveFeed({ items }: { items: Array<{ id: string; message: string; createdAt: number }> }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 7).map((item) => (
        <div key={item.id} className="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
          <Radio className="mt-0.5 size-4 shrink-0 text-cyan-600" />
          <span className="min-w-0 flex-1">{item.message}</span>
          <span className="shrink-0 text-xs text-slate-400">{relativeTime(item.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

export function AgentStatusCard({ event }: { event: AgentEvent }) {
  const statusTone = event.status === "complete" ? "mint" : event.status === "fallback" ? "mango" : event.status === "failed" ? "coral" : "violet";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-violet-100 text-violet-700">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-slate-950">{event.agentName}</h3>
            <IconPill tone={statusTone}>{event.status}</IconPill>
          </div>
          <p className="mt-1 text-sm font-bold leading-snug text-slate-600">{event.content}</p>
        </div>
      </div>
    </div>
  );
}

export function Leaderboard({
  title,
  entries,
  mode
}: {
  title: string;
  entries: Array<{ participant: Participant; score: Score }>;
  mode: "players" | "crowd";
}) {
  return (
    <Panel>
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="size-5 text-amber-500" />
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">Waiting for scores.</p>
        ) : (
          entries.map((entry, index) => (
            <div key={entry.participant.participantId} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <span className="grid size-8 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white">{index + 1}</span>
              <Avatar participant={entry.participant} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-950">{entry.participant.displayName}</p>
                <p className="text-xs font-bold text-slate-500">
                  {mode === "players"
                    ? `${entry.score.playerScore} player score`
                    : `${entry.score.supporterXp} Trust XP · ${supportAccuracyPercent(entry.score.supportAccuracyNum, entry.score.supportAccuracyDen)}% support accuracy`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

export function TechMetricStrip({
  connectedClients,
  reducerCalls,
  cheerEvents,
  p95,
  duplicateAnswers,
  doubleSpend
}: {
  connectedClients: number;
  reducerCalls: number;
  cheerEvents: number;
  p95: number;
  duplicateAnswers: number;
  doubleSpend: number;
}) {
  const metrics = [
    ["clients", connectedClients],
    ["reducers", reducerCalls],
    ["cheers", cheerEvents],
    ["p95", `${p95}ms`],
    ["dupes blocked", duplicateAnswers],
    ["Energy blocks", doubleSpend]
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-6">
      {metrics.map(([label, value]) => (
        <div key={String(label)} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-[11px] font-extrabold uppercase text-slate-500">{label}</p>
          <p className="text-lg font-black text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function QRJoinCard({ url, code }: { url: string; code: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
      <div className="rounded-lg bg-white p-4 ring-8 ring-violet-100">
        <QRCodeSVG value={url} size={260} level="H" />
      </div>
      <p className="mt-5 text-center text-lg font-extrabold uppercase tracking-[0.18em] text-slate-500">Session Code</p>
      <p className="text-center text-5xl font-black text-violet-700">{code}</p>
    </div>
  );
}

export function EnergyMeter({ energy }: { energy: number }) {
  const pct = Math.max(0, Math.min(100, (energy / 500) * 100));
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-black text-slate-950">
          <Zap className="size-5 text-amber-500" /> Energy
        </span>
        <span className="text-2xl font-black text-amber-600">{energy}</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TrustXPBadge({ xp }: { xp: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-700">
      <ShieldCheck className="size-4" />
      {xp} Trust XP
    </div>
  );
}

export function ConfettiBurst({ fireKey }: { fireKey: string | number | null | undefined }) {
  useEffect(() => {
    if (!fireKey) return;
    void confetti({
      particleCount: 120,
      spread: 68,
      origin: { y: 0.35 },
      colors: ["#8B5CF6", "#FFB703", "#22D3EE", "#34D399", "#FF6B6B"]
    });
  }, [fireKey]);

  return null;
}

export function ErrorState({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function LoadingLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </span>
  );
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function roundStatusLabel(status?: string): string {
  if (!status) return "Waiting";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function useCountdown(targetMs?: number | null): string {
  const now = useNow(1000);
  return useMemo(() => {
    if (!targetMs) return "00:30";
    const remaining = Math.max(0, targetMs - now);
    const seconds = Math.ceil(remaining / 1000);
    return `00:${String(seconds).padStart(2, "0")}`;
  }, [now, targetMs]);
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 3) return "now";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}
