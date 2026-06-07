import type { Participant, Score } from "@quizrush/shared";

export interface BracketEntry {
  participant: Participant;
  score: Score;
}

export interface BracketStageModel {
  stageIndex: number;
  label: string;
  size: number;
  entries: BracketEntry[];
}

export interface PositionedBracketNode {
  id: string;
  stageIndex: number;
  nodeIndex: number;
  x: number;
  y: number;
  size: number;
  entry?: BracketEntry;
  status: "active" | "advanced" | "eliminated" | "champion" | "empty";
  isLivePosition: boolean;
}

export interface BracketConnector {
  id: string;
  from: { x: number; y: number; size: number };
  to: { x: number; y: number; size: number };
  status: "pending" | "won" | "eliminated";
}

export function buildBracketStages(entries: BracketEntry[], progressStage: number): BracketStageModel[] {
  const visibleSize = visibleBracketSize(entries.length);
  if (visibleSize <= 1) return [];

  const stageSizes: number[] = [];
  for (let size = visibleSize; size >= 1; size = Math.floor(size / 2)) stageSizes.push(size);

  const visibleEntries = entries.slice(0, visibleSize);
  return stageSizes.map((size, stageIndex) => {
    const resolved = stageIndex <= progressStage;
    return {
      stageIndex,
      label: stageLabel(size, stageIndex, stageSizes.length),
      size,
      entries: resolved ? visibleEntries.slice(0, Math.min(size, visibleEntries.length)) : []
    };
  });
}

export function positionBracketNodes(input: {
  stages: BracketStageModel[];
  progressStage: number;
  finished: boolean;
}): PositionedBracketNode[] {
  const stageCount = input.stages.length;
  if (!stageCount) return [];
  const maxStageSize = input.stages[0]?.size ?? 2;
  const nodeSize = maxStageSize >= 32 ? 18 : maxStageSize >= 16 ? 28 : maxStageSize >= 8 ? 44 : 58;
  const participantLiveStage = new Map<string, number>();

  for (const stage of input.stages) {
    if (stage.stageIndex > input.progressStage) continue;
    for (const entry of stage.entries) {
      participantLiveStage.set(entry.participant.participantId, stage.stageIndex);
    }
  }

  return input.stages.flatMap((stage) => {
    const x = stageCount === 1 ? 50 : 7 + (stage.stageIndex / Math.max(1, stageCount - 1)) * 86;
    const count = Math.max(1, stage.size);
    return Array.from({ length: count }).map<PositionedBracketNode>((_, index) => {
      const entry = stage.entries[index];
      const y = count === 1 ? 50 : 8 + (index / Math.max(1, count - 1)) * 84;
      if (!entry) {
        return {
          id: `${stage.stageIndex}:empty:${index}`,
          stageIndex: stage.stageIndex,
          nodeIndex: index,
          x,
          y,
          size: Math.max(18, nodeSize - 12),
          status: "empty",
          isLivePosition: false
        };
      }
      const liveStage = participantLiveStage.get(entry.participant.participantId) ?? stage.stageIndex;
      const isChampion = input.finished && stage.stageIndex === stageCount - 1 && index === 0;
      const isEliminated = liveStage > stage.stageIndex;
      const isOutByState = entry.participant.championStatus === "eliminated" || entry.score.championStatus === "eliminated";
      return {
        id: `${stage.stageIndex}:${entry.participant.participantId}`,
        stageIndex: stage.stageIndex,
        nodeIndex: index,
        x,
        y,
        size: isChampion ? nodeSize + 14 : nodeSize,
        entry,
        status: isChampion
          ? "champion"
          : isOutByState
            ? "eliminated"
          : stage.stageIndex < liveStage
            ? "advanced"
            : stage.stageIndex < input.progressStage && !isEliminated
              ? "eliminated"
              : "active",
        isLivePosition: liveStage === stage.stageIndex && !isOutByState
      };
    });
  });
}

export function buildBracketConnectors(nodes: PositionedBracketNode[], stages: BracketStageModel[], progressStage: number): BracketConnector[] {
  const byStage = new Map<number, PositionedBracketNode[]>();
  for (const node of nodes) {
    const stageNodes = byStage.get(node.stageIndex) ?? [];
    stageNodes.push(node);
    byStage.set(node.stageIndex, stageNodes);
  }
  for (const stageNodes of byStage.values()) stageNodes.sort((a, b) => a.nodeIndex - b.nodeIndex);

  const connectors: BracketConnector[] = [];
  for (let stageIndex = 0; stageIndex < stages.length - 1; stageIndex += 1) {
    const sourceNodes = byStage.get(stageIndex) ?? [];
    const targetNodes = byStage.get(stageIndex + 1) ?? [];
    if (!sourceNodes.length || !targetNodes.length) continue;
    for (const source of sourceNodes) {
      const targetIndex = Math.min(targetNodes.length - 1, Math.floor(source.nodeIndex / 2));
      const target = targetNodes[targetIndex];
      if (!target) continue;
      const won = Boolean(source.entry && target.entry && target.entry.participant.participantId === source.entry.participant.participantId);
      connectors.push({
        id: `${source.id}->${target.id}`,
        from: { x: source.x, y: source.y, size: source.size },
        to: { x: target.x, y: target.y, size: target.size },
        status: won ? "won" : stageIndex < progressStage ? "eliminated" : "pending"
      });
    }
  }
  return connectors;
}

export function progressStageFor(input: { entries: BracketEntry[]; currentRound: number; finished: boolean }): number {
  const visibleSize = visibleBracketSize(input.entries.length);
  if (visibleSize <= 1) return 0;
  const maxStage = Math.max(1, Math.log2(visibleSize));
  if (input.finished) return maxStage;
  return Math.max(0, Math.min(maxStage, input.currentRound - 1));
}

export function visibleBracketSize(count: number): number {
  if (count <= 1) return count;
  const capped = Math.min(count, 32);
  return Math.max(2, nextPowerOfTwo(capped));
}

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

function stageLabel(size: number, stageIndex: number, totalStages: number): string {
  if (size === 1) return "Champion";
  if (size === 2) return "Final";
  if (size === 4) return "Semi";
  if (stageIndex === 0 && totalStages <= 3) return "Racers";
  return `Top ${size}`;
}
