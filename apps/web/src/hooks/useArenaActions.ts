import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import { buildTopicFallbackQuestions, DEFAULT_SESSION_CODE, DEFAULT_SESSION_ID, QUESTION_COUNT, type OptionKey } from "@quizrush/shared";
import { getDeviceIdentity, setJoinedParticipantId, useSpacetime } from "../lib/spacetime/client";

interface ActionState {
  loading: boolean;
  error: string | null;
  message: string | null;
}

function useActionRunner() {
  const [state, setState] = useState<ActionState>({ loading: false, error: null, message: null });

  const run = useCallback(
    async <T,>(label: string, action: () => Promise<T>) => {
      if (state.loading) return undefined;
      setState({ loading: true, error: null, message: null });
      try {
        const result = await action();
        setState({ loading: false, error: null, message: label });
        return result;
      } catch (error) {
        setState({ loading: false, error: error instanceof Error ? error.message : String(error), message: null });
        return undefined;
      }
    },
    [state.loading]
  );

  return { ...state, run };
}

export function useCreateSession() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const createSession = useCallback(
    (input: { code?: string; questionCount?: number } = {}) =>
      runner.run("Session ready", async () => {
        const receipt = await callReducer("create_session", input, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, createSession };
}

export function useJoinTournament(code = DEFAULT_SESSION_CODE) {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const joinTournament = useCallback(
    (input: { displayName: string; avatar: string }) =>
      runner.run("Joined tournament", async () => {
        const receipt = await callReducer<{ participant: { participantId: string } }>(
          "join_session",
          { code, displayName: input.displayName, avatar: input.avatar },
          getDeviceIdentity()
        );
        if (!receipt.ok) throw new Error(receipt.error);
        if (receipt.data?.participant.participantId) setJoinedParticipantId(receipt.data.participant.participantId, code);
        return receipt.data;
      }),
    [callReducer, code, runner]
  );
  return { ...runner, joinTournament };
}

export function useSubmitTopicVote() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const submitTopicVote = useCallback(
    (sessionId: string, topics: string[]) =>
      runner.run("Topics locked", async () => {
        const receipt = await callReducer("submit_topic_vote", { sessionId, topics }, getDeviceIdentity());
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, submitTopicVote };
}

export function useSubmitPlayerIntent() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const submitPlayerIntent = useCallback(
    (sessionId: string, rawText: string, transcriptSource: "typed" | "speech" = "typed") =>
      runner.run("Intent captured", async () => {
        const receipt = await callReducer("submit_player_intent", { sessionId, rawText, transcriptSource }, getDeviceIdentity());
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, submitPlayerIntent };
}

export function useRequestQuestions() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const requestQuestions = useCallback(
    (sessionId = DEFAULT_SESSION_ID, topic?: string) =>
      runner.run("Agent pipeline started", async () => {
        const receipt = await callReducer("request_questions", { sessionId, topic }, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, requestQuestions };
}

export function useSeedQuestions() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const seedQuestions = useCallback(
    (sessionId = DEFAULT_SESSION_ID, selectedTopic = "AI + Space + Startups") =>
      runner.run("Fallback questions ready", async () => {
        const receipt = await callReducer(
          "submit_question_pack",
          { sessionId, selectedTopic, questions: buildTopicFallbackQuestions(selectedTopic, QUESTION_COUNT) },
          "seed-fallback"
        );
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, seedQuestions };
}

export function useStartMatch() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const startMatch = useCallback(
    (sessionId = DEFAULT_SESSION_ID) =>
      runner.run("Match started", async () => {
        const receipt = await callReducer("start_match", { sessionId }, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, startMatch };
}

export function useSubmitAnswer() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const submitAnswer = useCallback(
    (roundId: string, selectedOption: OptionKey) =>
      runner.run("Locked in", async () => {
        const receipt = await callReducer(
          "submit_answer",
          { roundId, selectedOption, clientSentAt: Date.now(), clientEventId: nanoid() },
          getDeviceIdentity()
        );
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, submitAnswer };
}

export function useResolveRound() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const resolveRound = useCallback(
    (roundId: string) =>
      runner.run("Round resolved", async () => {
        const receipt = await callReducer("resolve_round", { roundId }, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, resolveRound };
}

export function useFinishMatch() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const finishMatch = useCallback(
    (sessionId = DEFAULT_SESSION_ID) =>
      runner.run("Winner ready", async () => {
        const receipt = await callReducer("finish_match", { sessionId, force: true }, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, finishMatch };
}

export function useCreateShareCard() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const createShareCard = useCallback(
    (sessionId = DEFAULT_SESSION_ID, participantId?: string | null) =>
      runner.run("Share card ready", async () => {
        const receipt = await callReducer("create_share_card", { sessionId, participantId }, getDeviceIdentity());
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, createShareCard };
}

export function useResetDemo() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const resetDemo = useCallback(
    (sessionId = DEFAULT_SESSION_ID) =>
      runner.run("Demo reset", async () => {
        const receipt = await callReducer("reset_demo", { sessionId }, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, resetDemo };
}

export function useAddSimulatedPlayers() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const addSimulatedPlayers = useCallback(
    (sessionId = DEFAULT_SESSION_ID, count = 100) =>
      runner.run("Simulated load added", async () => {
        const receipt = await callReducer("add_simulated_players", { sessionId, count }, "operator");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, addSimulatedPlayers };
}
