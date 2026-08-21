"use client";

import { useState } from "react";
import { MdEdit, MdLock } from "react-icons/md";
import ApplicationCard from "./ApplicationCard";
import QuantumSignerModal from "./QuantumSignerModal";
import QuantumVaultModal from "./QuantumVaultModal";

type OpenModal = "vault" | "signer" | null;

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
      </div>

      {openModal === "vault" && (
        <QuantumVaultModal onClose={() => setOpenModal(null)} />
      )}
      {openModal === "signer" && (
        <QuantumSignerModal onClose={() => setOpenModal(null)} />
      )}
    </>
  );
}
