import { useMemo } from "react";
import type { Session } from "@quizrush/shared";
import {
  buildBracketConnectors,
  buildBracketStages,
  positionBracketNodes,
  progressStageFor,
  type BracketEntry
} from "./bracketMath";

export function useBracketLayout(input: {
  entries: BracketEntry[];
  session?: Session;
}) {
  return useMemo(() => {
    const admitted = input.entries.filter((entry) => entry.participant.admissionStatus === "admitted");
    const finished = input.session?.status === "finished" || input.session?.status === "replay";
    const progressStage = progressStageFor({
      entries: admitted,
      currentRound: input.session?.currentRound ?? 0,
      finished
    });
    const stages = buildBracketStages(admitted, progressStage);
    const nodes = positionBracketNodes({ stages, progressStage, finished });
    const connectors = buildBracketConnectors(nodes, stages, progressStage);
    return {
      admitted,
      stages,
      nodes,
      connectors,
      progressStage,
      finished,
      overflowCount: Math.max(0, admitted.length - (stages[0]?.size ?? admitted.length))
    };
  }, [input.entries, input.session?.currentRound, input.session?.status]);
}
