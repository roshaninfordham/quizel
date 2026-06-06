import { useCallback, useMemo, useRef, useState } from "react";
import { isDuplicateTranscript, normalizeTranscript } from "@quizrush/shared";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export type SpeechIntentState = "unavailable" | "idle" | "listening" | "processing" | "error";

export function useSpeechIntent(onTranscript: (value: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef("");
  const lastCommittedRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const speechWindow = window as SpeechWindow;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  }, []);
  const [state, setState] = useState<SpeechIntentState>(SpeechRecognition ? "idle" : "unavailable");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");

  const stop = useCallback(() => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    if (state === "listening") setState("processing");
  }, [state]);

  const commitTranscript = useCallback(() => {
    const cleaned = normalizeTranscript(finalTranscriptRef.current);
    if (!cleaned) {
      setInterimTranscript("");
      setFinalTranscript("");
      return;
    }

    const now = Date.now();
    const previous = lastCommittedRef.current;
    if (!isDuplicateTranscript(cleaned, previous.text, now - previous.at)) {
      lastCommittedRef.current = { text: cleaned, at: now };
      setFinalTranscript(cleaned);
      onTranscript(cleaned);
    }
    setInterimTranscript("");
  }, [onTranscript]);

  const start = useCallback(() => {
    if (!SpeechRecognition || state === "listening") return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      let final = finalTranscriptRef.current;
      const results = Array.from(event.results);
      const startIndex = Math.max(0, event.resultIndex ?? 0);
      for (const result of results.slice(startIndex)) {
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) final = `${final} ${text}`.trim();
        else interim = `${interim} ${text}`.trim();
      }
      finalTranscriptRef.current = normalizeTranscript(final);
      setFinalTranscript(finalTranscriptRef.current);
      setInterimTranscript(normalizeTranscript(interim));
    };
    recognition.onerror = () => setState("error");
    recognition.onend = () => {
      commitTranscript();
      setState("idle");
    };
    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";
    setInterimTranscript("");
    setFinalTranscript("");
    setState("listening");
    recognition.start();
    stopTimerRef.current = window.setTimeout(() => stop(), 6000);
  }, [SpeechRecognition, commitTranscript, state, stop]);

  return {
    state,
    available: Boolean(SpeechRecognition),
    listening: state === "listening",
    interimTranscript,
    finalTranscript,
    start,
    stop
  };
}
