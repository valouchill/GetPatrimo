"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  FileText,
  Landmark,
  Link as LinkIcon,
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import UnifiedTunnelHeader from "@/app/components/UnifiedTunnelHeader";

const ACTS = [
  { id: "lease", label: "Acte I — Le Bail" },
  { id: "guarantee", label: "Acte II — La Caution" },
  { id: "compliance", label: "Acte III — Conformité" },
] as const;

type ActId = (typeof ACTS)[number]["id"];

type ComplianceItem = {
  id: string;
  label: string;
  hint: string;
  link: string;
  required: boolean;
};

type ComplianceState = {
  status: "missing" | "scanning" | "valid" | "warning" | "expired" | "optional";
  date?: string;
  notes?: string;
};

const initialComplianceState: Record<string, ComplianceState> = {
  dpe: { status: "missing" },
  erp: { status: "missing" },
  plomb: { status: "missing" },
  elec: { status: "missing" },
  gaz: { status: "missing" },
  boutin: { status: "missing" },
};

type ContractStudioClientProps = {
  propertyId: string;
};

export default function ContractStudioClient({
  propertyId,
}: ContractStudioClientProps) {
  const [activeAct, setActiveAct] = useState<ActId>("lease");
  const [guarantee, setGuarantee] = useState<"visale" | "physical">("visale");
  const [helpItem, setHelpItem] = useState<ComplianceItem | null>(null);
  const [clauses, setClauses] = useState({
    clim: false,
    domotique: false,
    nettoyage: false,
  });
  const [compliance, setCompliance] = useState(initialComplianceState);
  const [property, setProperty] = useState<Record<string, unknown> | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [signatureStatus, setSignatureStatus] = useState<
    "idle" | "merging" | "ready" | "error"
  >("idle");

  const constructionYear = Number(
    (property?.constructionYear as number) ||
      (property?.yearBuilt as number) ||
      (property?.builtYear as number) ||
      1935
  );

  const complianceItems = useMemo<ComplianceItem[]>(
    () => [
      {
        id: "dpe",
        label: "DPE (10 ans)",
        hint: "Valide 10 ans. Vérifiez la date de diagnostic.",
        link: "https://www.ecologie.gouv.fr/diagnostic-performance-energetique-dpe",
        required: true,
      },
      {
        id: "erp",
        label: "ERP (< 6 mois)",
        hint: "Générez votre ERP gratuitement sur Géorisques.",
        link: "https://www.georisques.gouv.fr/",
        required: true,
      },
      {
        id: "plomb",
        label: "Plomb (si < 1949)",
        hint: "Obligatoire si le bien est antérieur à 1949.",
        link: "https://www.service-public.fr/particuliers/vosdroits/F16096",
        required: constructionYear < 1949,
      },
      {
        id: "elec",
        label: "Électricité",
        hint: "Requis si installation > 15 ans.",
        link: "https://www.service-public.fr/particuliers/vosdroits/F16096",
        required: true,
      },
      {
        id: "gaz",
        label: "Gaz",
        hint: "Requis si installation > 15 ans.",
        link: "https://www.service-public.fr/particuliers/vosdroits/F16096",
        required: true,
      },
      {
        id: "boutin",
        label: "Surface Boutin",
        hint: "Mesurez la surface habitable pour la location nue.",
        link: "https://www.service-public.fr/particuliers/vosdroits/F32386",
        required: true,
      },
    ],
    [constructionYear]
  );

  const complianceComplete = useMemo(() => {
    return complianceItems.every((item) => {
      const state = compliance[item.id];
      if (!item.required) return true;
      return state.status === "valid";
    });
  }, [compliance, complianceItems]);

  const actsValid = useMemo(() => {
    return {
      lease: true,
      guarantee: guarantee === "visale" || guarantee === "physical",
      compliance: complianceComplete,
    };
  }, [guarantee, complianceComplete]);

  const signatureEnabled = Object.values(actsValid).every(Boolean);

  useEffect(() => {
    const token = window.localStorage.getItem("token") || "";
    setAuthToken(token);
  }, []);

  useEffect(() => {
    if (!authToken || !propertyId) return;
    const loadProperty = async () => {
      try {
        const response = await fetch(`/api/properties/${propertyId}`, {
          headers: { "x-auth-token": authToken },
        });
        if (!response.ok) return;
        const data = await response.json();
        setProperty(data);
      } catch (error) {
        console.error("Erreur chargement propriété:", error);
      }
    };
    loadProperty();
  }, [authToken, propertyId]);

  useEffect(() => {
    if (constructionYear >= 1949) {
      setCompliance((prev) => ({
        ...prev,
        plomb: {
          status: "optional",
          notes: "Non requis (bien postérieur à 1949).",
        },
      }));
    }
  }, [constructionYear]);

  const triggerUpload = (itemId: string) => {
    const input = document.getElementById(
      `docInput-${itemId}`
    ) as HTMLInputElement | null;
    if (input) input.click();
  };

  const handleUpload = async (itemId: string, file: File) => {
    if (!authToken) return;
    setCompliance((prev) => ({
      ...prev,
      [itemId]: { status: "scanning" },
    }));

    const typeMap: Record<string, string> = {
      dpe: "dpe",
      erp: "erp",
      plomb: "plomb",
      elec: "electricite",
      gaz: "gaz",
      boutin: "boutin",
    };

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", typeMap[itemId] || "diagnostic");

      const uploadRes = await fetch(
        `/api/documents/upload/${propertyId}`,
        {
          method: "POST",
          headers: { "x-auth-token": authToken },
          body: formData,
        }
      );
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadData.msg || "Upload impossible");
      }

      const analyzeRes = await fetch("/api/documents/diagnostics/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({
          documentId: uploadData._id || uploadData.id,
          docType: typeMap[itemId] || itemId,
        }),
      });
      const analyzeData = await analyzeRes.json().catch(() => ({}));
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.msg || "Analyse impossible");
      }

      const status: ComplianceState["status"] =
        analyzeData.status === "expired"
          ? "expired"
          : analyzeData.status === "warning"
          ? "warning"
          : "valid";

      setCompliance((prev) => ({
        ...prev,
        [itemId]: {
          status,
          date: analyzeData.diagnosticDate
            ? new Date(analyzeData.diagnosticDate).toLocaleDateString("fr-FR")
            : undefined,
          notes: analyzeData.notes || "",
        },
      }));
    } catch (error) {
      setCompliance((prev) => ({
        ...prev,
        [itemId]: {
          status: "warning",
          notes:
            error instanceof Error
              ? error.message
              : "Erreur lors de l'analyse",
        },
      }));
    }
  };

  const handleMergeDiagnostics = async () => {
    if (!authToken) return false;
    setSignatureStatus("merging");
    try {
      const response = await fetch(
        `/api/documents/diagnostics/merge/${propertyId}`,
        {
          method: "POST",
          headers: { "x-auth-token": authToken },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.msg || "Fusion impossible");
      }
      setSignatureStatus("ready");
      return true;
    } catch (error) {
      console.error("Erreur fusion diagnostics:", error);
      setSignatureStatus("error");
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <UnifiedTunnelHeader
        title={(property?.name as string) || "Résidence Montmartre"}
        subtitle={(property?.address as string) || "Adresse du bien"}
        onBack={() => window.history.back()}
        actions={
          <button className="rounded-full border border-emerald/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald transition hover:border-emerald hover:text-emerald">
            Marquer comme occupé
          </button>
        }
      />

      <div className="mx-auto grid max-w-7xl grid-cols-[1.1fr_0.9fr] gap-0">
        <section className="border-r border-slate-100 bg-white">
          <div className="sticky top-[128px] z-10 border-b border-slate-100 bg-white px-8 py-4">
            <div className="flex items-center gap-3">
              {ACTS.map((act) => (
                <button
                  key={act.id}
                  onClick={() => setActiveAct(act.id)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    activeAct === act.id
                      ? "bg-navy text-white shadow-lg shadow-navy/20"
                      : "bg-slate-50 text-slate-500 hover:text-navy"
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-8 py-8">
            <AnimatePresence mode="wait">
              {activeAct === "lease" ? (
                <motion.div
                  key="lease"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="font-serif text-xl text-navy">
                      Acte I — Le Bail Intelligent
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Ajustez les paramètres clés et les clauses premium.
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Loyer (€)
                        <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy" />
                      </label>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Charges (€)
                        <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy" />
                      </label>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Date de début
                        <input
                          type="date"
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Durée
                        <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy">
                          <option>12 mois</option>
                          <option>24 mois</option>
                          <option>36 mois</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-6 space-y-3">
                      {[
                        { key: "clim", label: "Entretien Climatisation" },
                        { key: "domotique", label: "Domotique" },
                        {
                          key: "nettoyage",
                          label: "Nettoyage Professionnel à la sortie",
                        },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-navy"
                        >
                          {item.label}
                          <input
                            type="checkbox"
                            checked={clauses[item.key as keyof typeof clauses]}
                            onChange={(event) =>
                              setClauses((prev) => ({
                                ...prev,
                                [item.key]: event.target.checked,
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {activeAct === "guarantee" ? (
                <motion.div
                  key="guarantee"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="font-serif text-xl text-navy">
                      Acte II — La Caution
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Sélectionnez la garantie et le garant certifié.
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      {[
                        { value: "visale", label: "Visale" },
                        { value: "physical", label: "Caution Physique" },
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => setGuarantee(item.value as "visale" | "physical")}
                          className={`rounded-2xl border px-4 py-5 text-left transition ${
                            guarantee === item.value
                              ? "border-emerald/40 bg-emerald/5"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold text-navy">
                            {item.label}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Sélection premium
                          </div>
                        </button>
                      ))}
                    </div>
                    {guarantee === "visale" ? (
                      <div className="mt-6">
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Numéro Visale
                          <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy" />
                        </label>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald">
                          <ShieldCheck className="h-4 w-4" />
                          Garant PatrimoTrust™
                        </div>
                        <div className="mt-2 text-sm text-navy">
                          Revenus validés • Identité vérifiée
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}

              {activeAct === "compliance" ? (
                <motion.div
                  key="compliance"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="font-serif text-xl text-navy">
                      Acte III — Coffre-fort de Conformité
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Chargez les diagnostics et validez leur conformité.
                    </p>
                    <div className="mt-6 space-y-3">
                      {complianceItems.map((item) => {
                        const state = compliance[item.id];
                        const isOptional = !item.required;
                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {state.status === "valid" ? (
                                  <ShieldCheck className="h-5 w-5 text-emerald" />
                                ) : (
                                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                                )}
                                <div>
                                  <div className="text-sm font-semibold text-navy">
                                    {item.label}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {isOptional
                                      ? "Non requis (après 1949)"
                                      : "Diagnostic requis"}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  state.status === "valid"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : state.status === "warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {state.status === "scanning"
                                  ? "Analyse IA"
                                  : state.status}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <button
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                                onClick={() => triggerUpload(item.id)}
                              >
                                <UploadCloud className="h-4 w-4" />
                                Uploader
                              </button>
                              <button
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                                onClick={() => setHelpItem(item)}
                              >
                                <LinkIcon className="h-4 w-4" />
                                Où le trouver ?
                              </button>
                              {state.date ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <CalendarDays className="h-4 w-4" />
                                  {state.date}
                                </div>
                              ) : null}
                            </div>
                            {state.notes ? (
                              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                {state.notes}
                              </div>
                            ) : null}
                            <input
                              id={`docInput-${item.id}`}
                              type="file"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  handleUpload(item.id, file);
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                      <BadgeCheck className="h-4 w-4" />
                      Dossier juridiquement conforme
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </section>

        <aside className="sticky top-[128px] h-[calc(100vh-128px)] bg-slate-100 px-8 py-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Prévisualisation
            </div>
            <div className="mt-4 font-serif text-2xl text-navy">
              Bail Intelligent — Résidence Montmartre
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Effet papier premium avec validation continue des clauses.
            </p>
            <motion.div
              key={`${guarantee}-${Object.values(clauses).some(Boolean)}-${complianceComplete}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 space-y-3 text-sm text-slate-600"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald" />
                Clauses premium :{" "}
                {Object.values(clauses).some(Boolean)
                  ? "Activées"
                  : "Aucune clause sélectionnée"}
              </div>
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald" />
                Garantie : {guarantee === "visale" ? "Visale" : "Caution Physique"}
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald" />
                Conformité : {complianceComplete ? "Validée" : "En attente"}
              </div>
            </motion.div>
            <button
              className="mt-8 w-full rounded-2xl bg-navy px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-50"
              disabled={!signatureEnabled}
              onClick={handleMergeDiagnostics}
            >
              {signatureStatus === "merging"
                ? "Préparation OpenSign..."
                : "Lancer la signature via OpenSign"}
            </button>
            {!signatureEnabled ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Acte III incomplet — conformité requise pour signer.
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {helpItem ? (
          <motion.aside
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed right-0 top-0 z-50 h-full w-80 border-l border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="text-sm font-semibold text-navy">{helpItem.label}</div>
            <p className="mt-2 text-sm text-slate-500">{helpItem.hint}</p>
            <a
              href={helpItem.link}
              target="_blank"
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald"
            >
              Ouvrir la ressource
              <LinkIcon className="h-4 w-4" />
            </a>
            <button
              className="mt-6 w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              onClick={() => setHelpItem(null)}
            >
              Fermer
            </button>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
