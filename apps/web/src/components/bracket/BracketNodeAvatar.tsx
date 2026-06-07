import { motion } from "framer-motion";
import { Crown, X } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PositionedBracketNode } from "./bracketMath";

export function BracketNodeAvatar({ node }: { node: PositionedBracketNode }) {
  if (!node.entry) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-white/18 bg-white/5"
        style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size, height: node.size }}
        aria-hidden="true"
      />
    );
  }

  const participant = node.entry.participant;
  const showName = node.size >= 42;
  const label = shortName(participant.displayName);
  return (
    <motion.div
      layout
      layoutId={node.isLivePosition ? `player-${participant.participantId}` : undefined}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: node.status === "eliminated" ? 0.35 : 1, scale: node.status === "champion" ? 1.08 : 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      title={`${participant.displayName} · rank #${node.entry.score.currentRank} · ${node.entry.score.totalScore} pts`}
    >
      <div
        className={twMerge(
          clsx(
            "relative grid place-items-center rounded-full border-[3px] text-center font-black shadow-xl transition",
            node.status === "champion"
              ? "border-amber-300 bg-amber-400 text-3xl shadow-amber-300/45"
              : node.status === "advanced"
                ? "border-emerald-300 bg-white text-2xl shadow-emerald-300/30"
                : node.status === "eliminated"
                  ? "border-slate-500 bg-slate-800 text-xl grayscale shadow-none"
                  : "border-white bg-white text-2xl shadow-violet-400/35"
          )
        )}
        style={{ width: node.size, height: node.size }}
      >
        <span className={node.status === "eliminated" ? "opacity-60" : ""}>{participant.avatar || initials(participant.displayName)}</span>
        {node.status === "champion" ? (
          <span className="absolute -right-2 -top-3 grid size-8 place-items-center rounded-full bg-white text-amber-500 shadow-lg">
            <Crown className="size-5" />
          </span>
        ) : null}
        {node.status === "eliminated" ? (
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-slate-950 text-slate-300">
            <X className="size-3" />
          </span>
        ) : null}
      </div>
      {showName ? (
        <div className="mt-1 max-w-24 text-center">
          <p className="truncate text-xs font-black leading-tight text-white">{label}</p>
          <p className="text-[10px] font-black leading-tight text-slate-400">#{node.entry.score.currentRank}</p>
        </div>
      ) : null}
    </motion.div>
  );
}

function shortName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}...` : name;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "Q").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
