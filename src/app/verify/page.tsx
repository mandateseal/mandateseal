import { VerifyClient } from "@/components/VerifyClient";

export default function VerifyPage() {
  return (
    <div className="page-container py-10">
      <div className="label">PROOF</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">VERIFY A RECEIPT</h1>
      <p className="mt-2 text-paperMuted text-sm max-w-2xl">
        Trust is a log, not a promise. Drop in a receipt ID or paste a full receipt JSON. We recompute
        the canonical hash and check the Ed25519 signature against the MandateSeal public key.
      </p>
      <div className="mt-8">
        <VerifyClient />
      </div>
    </div>
  );
}
