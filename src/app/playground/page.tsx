import { runScript } from "@/lib/playground";
import { PlaygroundClient } from "@/components/PlaygroundClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Playground · MandateSeal",
  description: "Watch an autonomous agent attempt 8 actions and see MandateSeal evaluate each one in real time.",
};

export default function PlaygroundPage() {
  const steps = runScript();
  return (
    <div className="page-container py-10 max-w-3xl">
      <div className="label">DEMO</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">PLAYGROUND</h1>
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        A scripted autonomous agent — Atlas-01 — attempts 8 actions under a research mandate.
        Every action runs through MandateSeal's real policy engine and Ed25519 signer.
        Watch which actions ship, which get blocked, and which escalate to a human.
      </p>
      <div className="mt-8">
        <PlaygroundClient steps={steps} />
      </div>
    </div>
  );
}
