import { useCallback, useState } from "react";
import { DEFAULT_JOIN_CODE, DEFAULT_SESSION_ID, type Difficulty, type QuestionCount } from "@quizduel/shared";
import { getDeviceIdentity, setJoinedParticipantId, useSpacetime } from "../lib/spacetime/client";

interface ActionState {
  loading: boolean;
  error: string | null;
  message: string | null;
}

function useActionRunner() {
  const [state, setState] = useState<ActionState>({ loading: false, error: null, message: null });

  const run = useCallback(async <T,>(label: string, action: () => Promise<T>) => {
    if (state.loading) return undefined;
    setState({ loading: true, error: null, message: null });
    try {
      const result = await action();
      setState({ loading: false, error: null, message: label });
      return result;
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        message: null
      });
      return undefined;
    }
  }, [state.loading]);

  return { ...state, run };
}

export function useCreateSession() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const createSession = useCallback(
    (input: { topic: string; difficulty: Difficulty; questionCount: QuestionCount }) =>
      runner.run("Session ready", async () => {
        const receipt = await callReducer("create_session", input, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, createSession };
}

export function useOpenLobby() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const openLobby = useCallback(
    (sessionId = DEFAULT_SESSION_ID) =>
      runner.run("Lobby open", async () => {
        const receipt = await callReducer("open_lobby", { sessionId }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, openLobby };
}

export function useResetDemo() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const resetDemo = useCallback(
    (sessionId = DEFAULT_SESSION_ID) =>
      runner.run("Demo reset", async () => {
        const receipt = await callReducer("reset_demo", { sessionId }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, resetDemo };
}

export function useAssignChampions() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const assignChampions = useCallback(
    (sessionId = DEFAULT_SESSION_ID) =>
      runner.run("Champions selected", async () => {
        const receipt = await callReducer("assign_champions_randomly", { sessionId }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, assignChampions };
}

export function useResolveRound() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const resolveRound = useCallback(
    (roundId: string) =>
      runner.run("Round resolved", async () => {
        const receipt = await callReducer("resolve_round", { roundId }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, resolveRound };
}

export function useHostActions() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();

  const generateQuiz = useCallback(
    (input: { sessionId: string; topic: string; difficulty: Difficulty; questionCount: QuestionCount }) =>
      runner.run("AI quiz request queued", async () => {
        const request = await callReducer<{ requestId: string }>(
          "request_questions",
          {
            sessionId: input.sessionId,
            topic: input.topic,
            difficulty: input.difficulty,
            questionCount: input.questionCount
          },
          "host-local"
        );
        if (!request.ok) throw new Error(request.error);
        await callReducer(
          "record_agent_event",
          {
            sessionId: input.sessionId,
            agentName: "Quiz Author Agent",
            eventType: "generation_running",
            content: "Worker is generating and validating quiz JSON.",
            confidence: 0.86,
            status: "running"
          },
          "agent-worker"
        );
        return request.data;
      }),
    [callReducer, runner]
  );

  const addSimulatedSupporters = useCallback(
    (sessionId: string, count = 100) =>
      runner.run("Simulated supporters added", async () => {
        const receipt = await callReducer("add_simulated_supporters", { sessionId, count }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );

  const startMatch = useCallback(
    (matchId: string) =>
      runner.run("Match started", async () => {
        const receipt = await callReducer("start_match", { matchId }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );

  const startRound = useCallback(
    (matchId: string, roundNumber: number) =>
      runner.run("Next round started", async () => {
        const receipt = await callReducer("start_round", { matchId, roundNumber }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );

  const finishMatch = useCallback(
    (matchId: string, force = false) =>
      runner.run("Final leaderboard ready", async () => {
        const receipt = await callReducer("finish_match", { matchId, force }, "host-local");
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );

  return {
    ...runner,
    generateQuiz,
    addSimulatedSupporters,
    startMatch,
    startRound,
    finishMatch
  };
}

export function useJoinArena() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const joinArena = useCallback(
    (input: { joinCode?: string; displayName: string; roleRequested: "player" | "crowd"; interests: string[] }) =>
      runner.run("Joined arena", async () => {
        const receipt = await callReducer<{
          participant: { participantId: string; roleRequested: "player" | "crowd" };
        }>(
          "join_session",
          {
            joinCode: input.joinCode ?? DEFAULT_JOIN_CODE,
            displayName: input.displayName,
            roleRequested: input.roleRequested,
            interests: input.interests
          },
          getDeviceIdentity()
        );
        if (!receipt.ok) throw new Error(receipt.error);
        if (receipt.data?.participant.participantId) {
          setJoinedParticipantId(receipt.data.participant.participantId);
        }
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, joinArena };
}

export function useSubmitAnswer() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const submitAnswer = useCallback(
    (roundId: string, selectedOption: string) =>
      runner.run("Answer locked", async () => {
        const receipt = await callReducer("submit_answer", { roundId, selectedOption }, getDeviceIdentity());
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, submitAnswer };
}

export function usePlayAlongAnswer() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const submitPlayalongAnswer = useCallback(
    (roundId: string, selectedOption: string) =>
      runner.run("Pick locked", async () => {
        const receipt = await callReducer("submit_playalong_answer", { roundId, selectedOption }, getDeviceIdentity());
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, submitPlayalongAnswer };
}

export function useCheerPlayer() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const cheerPlayer = useCallback(
    (roundId: string, playerId: string) =>
      runner.run("Cheer sent", async () => {
        const receipt = await callReducer(
          "support_player",
          {
            roundId,
            playerId,
            amount: 25,
            clientEventId: `${getDeviceIdentity()}-${roundId}-${playerId}-${Date.now()}`
          },
          getDeviceIdentity()
        );
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, cheerPlayer };
}

export function usePlayerReady() {
  const { callReducer } = useSpacetime();
  const runner = useActionRunner();
  const playerReady = useCallback(
    (matchId: string) =>
      runner.run("Ready", async () => {
        const receipt = await callReducer("player_ready", { matchId }, getDeviceIdentity());
        if (!receipt.ok) throw new Error(receipt.error);
        return receipt.data;
      }),
    [callReducer, runner]
  );
  return { ...runner, playerReady };
}
