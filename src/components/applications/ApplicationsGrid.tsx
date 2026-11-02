"use client";

import { useState } from "react";
import { MdEdit, MdGroups, MdLock, MdVpnKey,  MdSpeed, MdWifiTethering, MdFactCheck  } from "react-icons/md";
import ApplicationCard from "./ApplicationCard";
import JwtInspectorModal from "./JwtInspectorModal";
import KeySplitModal from "./KeySplitModal";
import QuantumSignerModal from "./QuantumSignerModal";
import QuantumVaultModal from "./QuantumVaultModal";
import SpeedTestModal from "./SpeedTestModal";
import HarvestModal from "./HarvestModal";
import TestVectorModal from "./TestVectorModal";

type OpenModal = "vault" | "signer" | "keysplit" | "jwt" | "speed" | "harvest" | "vectors" | null;

export default function ApplicationsGrid() {
  const [openModal, setOpenModal] = useState<OpenModal>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 mt-12">
        <ApplicationCard
          title="Quantum Vault"
          description="Encrypts a secret using ML-KEM-768 and AES-256-GCM."
          icon={MdLock}
          tag="Demo"
          onClick={() => setOpenModal("vault")}
        />

        <ApplicationCard
          title="Quantum-Safe Signer"
          description="Signs any text with ML-DSA-65."
          icon={MdEdit}
          tag="Demo"
          onClick={() => setOpenModal("signer")}
        />

        <ApplicationCard
          title="Secret Split"
          description="Lock a secret so that several people must work together to open it."
          icon={MdGroups}
          tag="Tool"
          onClick={() => setOpenModal("keysplit")}
        />

        <ApplicationCard
          title="Quantum-Aware JWT Inspector"
          description="Paste a login token. See if a quantum computer could forge it."
          icon={MdVpnKey}
          tag="Tool"
          onClick={() => setOpenModal("jwt")}
        />

        
        <ApplicationCard
          title="PQC Speed Test"
          description="Benchmark post-quantum algorithms on this device."
          icon={MdSpeed}
          tag="Tool"
          onClick={() => setOpenModal("speed")}
        />
        <ApplicationCard
          title="Harvest Now, Decrypt Later"
          description="Record a key exchange. Attack the recording. See what breaks."
          icon={MdWifiTethering}
          tag="Demo"
          onClick={() => setOpenModal("harvest")}
        />
                <ApplicationCard
          title="Test Vector Check"
          description="Run NIST's official test vectors. Pass or fail, live."
          icon={MdFactCheck}
          tag="Tool"
          onClick={() => setOpenModal("vectors")}
        />
      </div>

      {openModal === "vault" && (
        <QuantumVaultModal onClose={() => setOpenModal(null)} />
      )}
      {openModal === "signer" && (
        <QuantumSignerModal onClose={() => setOpenModal(null)} />
      )}
      {openModal === "keysplit" && (
        <KeySplitModal onClose={() => setOpenModal(null)} />
      )}
      {openModal === "jwt" && (
        <JwtInspectorModal onClose={() => setOpenModal(null)} />
      )}
      {openModal === "speed" && (
        <SpeedTestModal onClose={() => setOpenModal(null)} />
      )}
      {openModal === "harvest" && (
        <HarvestModal onClose={() => setOpenModal(null)} />
      )}
            {openModal === "vectors" && (
        <TestVectorModal onClose={() => setOpenModal(null)} />
      )}
    </>
  );
}