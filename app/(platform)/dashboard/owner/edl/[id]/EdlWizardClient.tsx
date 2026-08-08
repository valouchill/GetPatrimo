'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import WizardShell from './components/WizardShell';
import InfoMetersStep from './steps/InfoMetersStep';
import RoomStep from './steps/RoomStep';
import SignaturesStep from './steps/SignaturesStep';
import SummaryStep from './steps/SummaryStep';

interface Room {
  name: string;
  order: number;
  wallCondition: string;
  floorCondition: string;
  ceilingCondition: string;
  equipment: { name: string; condition: string; comment: string }[];
  photos: { url: string; caption: string }[];
  comment: string;
}

interface Inspection {
  _id: string;
  type: 'ENTRY' | 'EXIT';
  status: string;
  date: string;
  property?: { _id: string; name?: string; address?: string };
  lease?: { tenantFirstName?: string; tenantLastName?: string; depositAmount?: number };
  rooms: Room[];
  meterReadings?: { water?: number; gas?: number; electricity?: number; heating?: number };
  keysDelivered?: { type: string; quantity: number; description: string }[];
  signatures?: {
    owner?: { data?: string; date?: string; name?: string };
    tenant?: { data?: string; date?: string; name?: string };
  };
  pdfUrl?: string;
  [key: string]: unknown;
}

export default function EdlWizardClient({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const direction = useRef(1);

  // Fetch inspection
  useEffect(() => {
    fetch(`/api/inspections/${inspectionId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setInspection(res.data);
      })
      .finally(() => setLoading(false));
  }, [inspectionId]);

  // Steps: Info + rooms + Signatures + Summary
  const totalSteps = inspection ? 1 + inspection.rooms.length + 2 : 0;

  function getStepTitle(step: number): string {
    if (!inspection) return '';
    if (step === 0) return 'Infos & Compteurs';
    if (step <= inspection.rooms.length) return inspection.rooms[step - 1].name;
    if (step === inspection.rooms.length + 1) return 'Signatures';
    return 'Résumé';
  }

  // Save to API
  const save = useCallback(async (data?: Partial<Inspection>, status?: string) => {
    if (!inspection) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        rooms: data?.rooms ?? inspection.rooms,
        meterReadings: data?.meterReadings ?? inspection.meterReadings,
        keysDelivered: data?.keysDelivered ?? inspection.keysDelivered ?? [],
        status: status || (inspection.status === 'DRAFT' ? 'IN_PROGRESS' : inspection.status),
      };
      if (data?.signatures ?? inspection.signatures) {
        payload.signatures = data?.signatures ?? inspection.signatures;
      }
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setInspection(result.data);
      } else if (!res.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde');
      }
    } finally {
      setSaving(false);
    }
  }, [inspection, inspectionId]);

  // Navigation
  async function goNext() {
    if (!inspection) return;
    if (currentStep < totalSteps - 1) {
      await save();
      direction.current = 1;
      setCurrentStep((s) => s + 1);
    }
  }

  async function goPrev() {
    if (currentStep > 0) {
      await save();
      direction.current = -1;
      setCurrentStep((s) => s - 1);
    }
  }

  function goBack() {
    router.push('/dashboard/owner?tab=edl');
  }

  // Update handlers
  function updateInspection(changes: Partial<Inspection>) {
    if (!inspection) return;
    setInspection({ ...inspection, ...changes });
  }

  function updateRoom(roomIndex: number, updatedRoom: Room) {
    if (!inspection) return;
    const newRooms = inspection.rooms.map((r, i) => (i === roomIndex ? updatedRoom : r));
    setInspection({ ...inspection, rooms: newRooms });
  }

  async function handleFinalize(status: 'IN_PROGRESS' | 'COMPLETED') {
    await save(undefined, status);
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">
        <p className="text-lg font-semibold text-slate-900">EDL introuvable</p>
        <button onClick={goBack} className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white">
          Retour
        </button>
      </div>
    );
  }

  const isLastStep = currentStep === totalSteps - 1;

  // Animation variants
  const variants = {
    enter: { x: direction.current > 0 ? 60 : -60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: direction.current > 0 ? -60 : 60, opacity: 0 },
  };

  function renderStep() {
    // inspection is guaranteed non-null here (early return above)
    const ins = inspection!;
    if (currentStep === 0) {
      return <InfoMetersStep inspection={ins} onUpdate={updateInspection} />;
    }
    if (currentStep <= ins.rooms.length) {
      const roomIdx = currentStep - 1;
      return (
        <RoomStep
          room={ins.rooms[roomIdx]}
          roomIndex={roomIdx}
          inspectionId={ins._id}
          onUpdate={updateRoom}
        />
      );
    }
    if (currentStep === ins.rooms.length + 1) {
      return (
        <SignaturesStep
          signatures={ins.signatures}
          onUpdate={(sigs) => updateInspection({ signatures: sigs })}
        />
      );
    }
    return <SummaryStep inspection={ins} onFinalize={handleFinalize} />;
  }

  return (
    <WizardShell
      title={getStepTitle(currentStep)}
      currentStep={currentStep}
      totalSteps={totalSteps}
      saving={saving}
      onBack={goBack}
      onPrev={goPrev}
      onNext={isLastStep ? () => handleFinalize('COMPLETED') : goNext}
      isLastStep={isLastStep}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentStep}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </WizardShell>
  );
}
