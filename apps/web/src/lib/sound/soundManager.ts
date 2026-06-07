import { Howl, Howler } from "howler";

type SoundName =
  | "join"
  | "micStart"
  | "micStop"
  | "intentDetected"
  | "arenaAssigned"
  | "countdown"
  | "question"
  | "answerLock"
  | "correct"
  | "wrong"
  | "rankUp"
  | "winner"
  | "replay";

const soundSpecs: Record<SoundName, { frequency: number; durationMs: number; type?: OscillatorType; volume: number }> = {
  join: { frequency: 392, durationMs: 64, volume: 0.045 },
  micStart: { frequency: 440, durationMs: 80, volume: 0.045 },
  micStop: { frequency: 330, durationMs: 74, volume: 0.035 },
  intentDetected: { frequency: 523, durationMs: 105, volume: 0.045 },
  arenaAssigned: { frequency: 659, durationMs: 135, volume: 0.05 },
  countdown: { frequency: 494, durationMs: 48, volume: 0.038 },
  question: { frequency: 466, durationMs: 88, volume: 0.038 },
  answerLock: { frequency: 349, durationMs: 62, type: "triangle", volume: 0.04 },
  correct: { frequency: 698, durationMs: 145, volume: 0.052 },
  wrong: { frequency: 247, durationMs: 96, type: "triangle", volume: 0.03 },
  rankUp: { frequency: 784, durationMs: 120, volume: 0.046 },
  winner: { frequency: 523, durationMs: 360, volume: 0.058 },
  replay: { frequency: 294, durationMs: 110, type: "triangle", volume: 0.03 }
};

let muted = true;
let initialized = false;
const sounds = new Map<SoundName, Howl>();
let lastJoinAt = 0;

export function initSounds({ mutedByDefault = true }: { mutedByDefault?: boolean } = {}) {
  if (initialized || typeof window === "undefined") return;
  muted = readMutedPreference(mutedByDefault);
  Howler.mute(muted);
  for (const [name, spec] of Object.entries(soundSpecs) as Array<[SoundName, (typeof soundSpecs)[SoundName]]>) {
    sounds.set(
      name,
      new Howl({
        src: [toneDataUri(spec.frequency, spec.durationMs, spec.type)],
        volume: spec.volume,
        preload: true
      })
    );
  }
  initialized = true;
}

export function unlockAudioOnFirstTap() {
  initSounds();
  void Howler.ctx?.resume?.();
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") window.localStorage.setItem("quizrush:sound-muted", String(value));
  Howler.mute(value);
}

export function getMuted() {
  return muted;
}

export function playJoin() {
  const now = Date.now();
  if (now - lastJoinAt < 300) return;
  lastJoinAt = now;
  play("join");
}

export const playMicStart = () => play("micStart");
export const playMicStop = () => play("micStop");
export const playIntentDetected = () => play("intentDetected");
export const playArenaAssigned = () => play("arenaAssigned");
export const playStepComplete = () => play("intentDetected");
export const playQuizReady = () => play("arenaAssigned");
export const playCountdownTick = () => play("countdown");
export const playQuestionStart = () => play("question");
export const playAnswerLock = () => play("answerLock");
export const playCorrect = () => play("correct");
export const playWrong = () => play("wrong");
export const playRankUp = () => play("rankUp");
export const playWinner = () => play("winner");
export const playReplayWhoosh = () => play("replay");

function play(name: SoundName) {
  initSounds();
  if (muted) return;
  sounds.get(name)?.play();
}

function readMutedPreference(defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  const stored = window.localStorage.getItem("quizrush:sound-muted");
  return stored === null ? defaultValue : stored === "true";
}

function toneDataUri(frequency: number, durationMs: number, type: OscillatorType = "sine"): string {
  const sampleRate = 22_050;
  const length = Math.floor((durationMs / 1000) * sampleRate);
  const data = new Uint8Array(44 + length * 2);
  writeString(data, 0, "RIFF");
  writeUint32(data, 4, 36 + length * 2);
  writeString(data, 8, "WAVEfmt ");
  writeUint32(data, 16, 16);
  writeUint16(data, 20, 1);
  writeUint16(data, 22, 1);
  writeUint32(data, 24, sampleRate);
  writeUint32(data, 28, sampleRate * 2);
  writeUint16(data, 32, 2);
  writeUint16(data, 34, 16);
  writeString(data, 36, "data");
  writeUint32(data, 40, length * 2);

  for (let index = 0; index < length; index += 1) {
    const t = index / sampleRate;
    const envelope = Math.sin(Math.PI * (index / length));
    const raw = waveValue(type, frequency, t) * envelope * 0.55;
    const sample = Math.max(-1, Math.min(1, raw)) * 32767;
    writeInt16(data, 44 + index * 2, sample);
  }

  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function waveValue(type: OscillatorType, frequency: number, t: number): number {
  const phase = (t * frequency) % 1;
  if (type === "square") return phase < 0.5 ? 1 : -1;
  if (type === "sawtooth") return phase * 2 - 1;
  if (type === "triangle") return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
  return Math.sin(2 * Math.PI * frequency * t);
}

function writeString(data: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) data[offset + index] = value.charCodeAt(index);
}

function writeUint16(data: Uint8Array, offset: number, value: number) {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >> 8) & 0xff;
}

function writeUint32(data: Uint8Array, offset: number, value: number) {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >> 8) & 0xff;
  data[offset + 2] = (value >> 16) & 0xff;
  data[offset + 3] = (value >> 24) & 0xff;
}

function writeInt16(data: Uint8Array, offset: number, value: number) {
  const sample = value < 0 ? 0x10000 + value : value;
  writeUint16(data, offset, sample);
}
