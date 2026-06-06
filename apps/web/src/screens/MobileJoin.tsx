import { useMemo, useState } from "react";
import { Crown, Users, Zap } from "lucide-react";
import { DEFAULT_JOIN_CODE } from "@quizduel/shared";
import { useJoinArena } from "../hooks/useArenaActions";
import { getJoinedParticipantId, useEnergyBalance, useSession, useSpacetime } from "../lib/spacetime/client";
import { getParticipant } from "../lib/selectors";
import { Button, ConnectionBadge, EnergyMeter, ErrorState, IconPill, PhoneShell, ReconnectingBanner } from "../components/ui";

const interests = ["AI", "Space", "Startups", "Science", "History", "Gaming"];

export function MobileJoin({ joinCode = DEFAULT_JOIN_CODE }: { joinCode?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const session = useSession();
  const [name, setName] = useState("");
  const [roleRequested, setRoleRequested] = useState<"player" | "crowd">("player");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["AI", "Space"]);
  const join = useJoinArena();
  const participant = getParticipant(state, getJoinedParticipantId());
  const balance = useEnergyBalance(participant?.participantId);

  const selectedRoleCopy = useMemo(() => {
    if (!participant) return null;
    if (participant.roleAssigned === "player1" || participant.roleAssigned === "player2") {
      return {
        title: "You are a Champion",
        detail: "Open your player phone. The room will see you on the reveal screen.",
        href: `/play/${participant.sessionId}`,
        cta: "Open Player Phone"
      };
    }
    if (participant.roleRequested === "player") {
      return {
        title: "Waiting for Champion selection",
        detail: "If you are not selected, you will cheer from the Crowd with Energy.",
        href: `/crowd/${participant.sessionId}`,
        cta: "Open Crowd Phone"
      };
    }
    return {
      title: "You are in the Crowd",
      detail: "Play along, cheer with Energy, and climb the supporter leaderboard.",
      href: `/crowd/${participant.sessionId}`,
      cta: "Open Crowd Phone"
    };
  }, [participant]);

  function toggleInterest(interest: string) {
    setSelectedInterests((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]
    );
  }

  if (participant && selectedRoleCopy) {
    return (
      <PhoneShell>
        <div className="flex items-center justify-between gap-3">
          <IconPill tone={participant.roleAssigned === "crowd" ? "aqua" : "violet"}>
            {participant.roleAssigned === "crowd" ? <Users className="size-4" /> : <Crown className="size-4" />}
            Joined
          </IconPill>
          <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        </div>
        <ReconnectingBanner state={connectionState} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">{selectedRoleCopy.title}</h1>
          <p className="mt-2 text-base font-bold text-slate-600">{selectedRoleCopy.detail}</p>
          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-extrabold uppercase text-slate-500">Arena</p>
            <p className="text-2xl font-black text-violet-700">{session?.joinCode ?? joinCode}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">{session?.topic ?? "AI + Space + Startups"}</p>
          </div>
        </section>
        <EnergyMeter energy={balance?.spendableEnergy ?? 500} />
        <a href={selectedRoleCopy.href}>
          <Button className="w-full" icon={<Zap className="size-5" />}>
            {selectedRoleCopy.cta}
          </Button>
        </a>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div className="flex items-center justify-between gap-3">
        <IconPill tone="violet">
          <Zap className="size-4" /> QuizDuel Live
        </IconPill>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </div>
      <ReconnectingBanner state={connectionState} />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-4xl font-black text-slate-950">Join Arena</h1>
        <p className="mt-2 text-base font-bold text-slate-600">Choose your role. No login, no email, just the live room.</p>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void join.joinArena({
              joinCode,
              displayName: name || "Guest",
              roleRequested,
              interests: selectedInterests
            });
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm font-extrabold uppercase text-slate-500">Display name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Maya"
              className="min-h-14 rounded-lg border border-slate-200 px-4 text-lg font-extrabold outline-none ring-violet-200 focus:ring-4"
            />
          </label>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setRoleRequested("player")}
              className={`rounded-lg border-2 p-4 text-left transition ${
                roleRequested === "player" ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Crown className="size-6 text-violet-600" />
                <div>
                  <p className="text-lg font-black text-slate-950">I want to play</p>
                  <p className="text-sm font-bold text-slate-500">Enter the Champion selection pool.</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRoleRequested("crowd")}
              className={`rounded-lg border-2 p-4 text-left transition ${
                roleRequested === "crowd" ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="size-6 text-cyan-600" />
                <div>
                  <p className="text-lg font-black text-slate-950">Join the Crowd</p>
                  <p className="text-sm font-bold text-slate-500">Cheer, play along, and earn Trust XP.</p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`min-h-11 rounded-full px-4 text-sm font-extrabold transition ${
                  selectedInterests.includes(interest) ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {interest}
              </button>
            ))}
          </div>

          <ErrorState message={join.error} />
          <Button disabled={join.loading} type="submit" className="w-full" icon={<Zap className="size-5" />}>
            Join Arena
          </Button>
        </form>
      </section>
    </PhoneShell>
  );
}
