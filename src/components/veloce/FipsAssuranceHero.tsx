"use client";

import { useState } from "react";
import { MdRefresh, MdPlayArrow } from "react-icons/md";
import LRButton from "@/components/ui/LRButton";
import Modal from "@/components/ui/Modal";

// Top box of the Security dashboard: the FIPS module assurance statement plus
// the Refresh / Run self-tests actions. "Run self-tests" opens an (empty)
// result modal — wire it to the agent's /self-test endpoint later. This is a
// shell: the buttons don't call anything yet.
export default function FipsAssuranceHero() {
  const [selfTestOpen, setSelfTestOpen] = useState(false);

  return (
    <>
      <div className="default-radius flex flex-col items-start justify-between gap-4 border border-gray-100 bg-gray-50 p-6 sm:flex-row sm:items-center">
        <div>
          <p className="color-brand-primary font-mono text-2xs font-bold uppercase tracking-[0.2em]">
            Cryptographic runtime
          </p>
          <h2 className="mt-1 text-xl font-medium">FIPS module assurance</h2>
          <p className="mt-1 text-sm text-gray-500">
            Live status from the local Veloce agent will appear here.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <LRButton
            variant="secondary-outline"
            icon={<MdRefresh className="text-lg" />}
          >
            Refresh
          </LRButton>
          <LRButton
            variant="primary"
            icon={<MdPlayArrow className="text-lg" />}
            onClick={() => setSelfTestOpen(true)}
          >
            Run self-tests
          </LRButton>
        </div>
      </div>

      <Modal
        open={selfTestOpen}
        onClose={() => setSelfTestOpen(false)}
        eyebrow="On-demand result"
        title="Self-tests"
        footer={
          <LRButton
            variant="secondary-outline"
            onClick={() => setSelfTestOpen(false)}
          >
            Close
          </LRButton>
        }
      >
        <div className="default-radius border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Self-test output will render here.
        </div>
      </Modal>
    </>
  );
}
