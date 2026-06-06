import { useCallback, useMemo, useRef, useState } from "react";

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
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export type SpeechIntentState = "unavailable" | "idle" | "listening" | "processing" | "error";

export function useSpeechIntent(onTranscript: (value: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const speechWindow = window as SpeechWindow;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  }, []);
  const [state, setState] = useState<SpeechIntentState>(SpeechRecognition ? "idle" : "unavailable");

  const stop = useCallback(() => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    if (state === "listening") setState("processing");
  }, [state]);

  const start = useCallback(() => {
    if (!SpeechRecognition || state === "listening") return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onTranscript(text);
    };
    recognition.onerror = () => setState("error");
    recognition.onend = () => setState("idle");
    recognitionRef.current = recognition;
    setState("listening");
    recognition.start();
    stopTimerRef.current = window.setTimeout(() => stop(), 8000);
  }, [SpeechRecognition, onTranscript, state, stop]);

  return {
    state,
    available: Boolean(SpeechRecognition),
    listening: state === "listening",
    start,
    stop
  };
}
