"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Sofa,
  FileScan,
  ImageIcon,
  Sparkles,
  ChevronRight,
  Loader2,
  Check,
} from "lucide-react";

type StepId = "address" | "furnished" | "dpe" | "photos" | "thinking" | "result";

type FormData = {
  address: string;
  furnished: "vide" | "meuble" | null;
  dpeFile: File | null;
  dpeData: { surface?: number; etiquette?: string } | null;
  photos: { data: string; name: string }[];
};

const STEPS: { id: StepId; question: string; sub?: string }[] = [
  {
    id: "address",
    question: "Où se situe le joyau que vous souhaitez valoriser ?",
    sub: "Saisissez l'adresse de votre bien. L'IA se charge du reste.",
  },
  {
    id: "furnished",
    question: "Votre bien est-il meublé ou non meublé ?",
    sub: "Cette information impacte le positionnement marché.",
  },
  {
    id: "dpe",
    question: "Avez-vous votre DPE ou Acte de Propriété ?",
    sub: "Glissez le document pour extraire surface et étiquette énergétique.",
  },
  {
    id: "photos",
    question: "Partagez les photos de votre bien.",
    sub: "L'IA identifiera les matériaux, la luminosité et les atouts visuels.",
  },
];

const fadeSlide = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

export default function ConciergeOnboardingClient() {
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    address: "",
    furnished: null,
    dpeFile: null,
    dpeData: null,
    photos: [],
  });
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{
    loyer: number;
    annonce: string;
    features: string[];
  } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<
    { label: string; value: string }[]
  >([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const addressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[stepIndex]?.id ?? "address";
  const isLastQuestion = stepIndex >= STEPS.length - 1;

  // Address autocomplete
  useEffect(() => {
    if (addressInput.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    addressTimerRef.current = setTimeout(() => {
      fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addressInput)}&limit=5`
      )
        .then((r) => { if (!r.ok) throw new Error('API error'); return r.json(); })
        .then((data: { features?: { properties: { label: string } }[] }) => {
          const items =
            data.features?.map((f: { properties: { label: string } }) => ({
              label: f.properties.label,
              value: f.properties.label,
            })) ?? [];
          setAddressSuggestions(items);
          setShowAddressDropdown(items.length > 0);
        })
        .catch(() => { setAddressSuggestions([]); setShowAddressDropdown(false); });
    }, 300);
    return () => {
      if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    };
  }, [addressInput]);

  const selectAddress = (addr: string) => {
    setFormData((p) => ({ ...p, address: addr }));
    setAddressInput(addr);
    setShowAddressDropdown(false);
    setAddressSuggestions([]);
    goNext();
  };

  const confirmAddress = () => {
    if (addressInput.trim().length >= 3) {
      setFormData((p) => ({ ...p, address: addressInput.trim() }));
      goNext();
    }
  };

  const selectFurnished = (value: "vide" | "meuble") => {
    setFormData((p) => ({ ...p, furnished: value }));
    goNext();
  };

  const handleDpeDrop = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      if (!file.type.includes("pdf") && !file.type.startsWith("image/"))
        return;
      setFormData((p) => ({ ...p, dpeFile: file }));
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      try {
        const r = await fetch("/api/owner-tunnel/scan-dpe", {
          method: "POST",
          body: formDataUpload,
        });
        const res = await r.json();
        if (res.dpe) {
          setFormData((p) => ({
            ...p,
            dpeData: {
              surface: res.dpe.surface_habitable_m2 ?? undefined,
              etiquette: res.dpe.etiquette_energie,
            },
          }));
        }
      } catch (e) {
        console.warn("DPE scan:", e);
      }
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    },
    []
  );

  const handlePhotosDrop = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result as string;
          setFormData((p) => ({
            ...p,
            photos: [...p.photos, { data, name: file.name }].slice(0, 10),
          }));
        };
        reader.readAsDataURL(file);
      });
    },
    []
  );

  const removePhoto = (i: number) => {
    setFormData((p) => ({
      ...p,
      photos: p.photos.filter((_, idx) => idx !== i),
    }));
  };

  const confirmPhotos = () => {
    goNext();
  };

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else if (currentStep === "photos") {
      launchAnalysis();
    }
  }, [stepIndex, currentStep]);

  const launchAnalysis = async () => {
    setIsThinking(true);
    setShowResult(false);
    const texts = [
      "Analyse des volumes en cours...",
      "Identification des matériaux nobles...",
      "Calcul du positionnement marché...",
      "Génération de l'annonce optimisée...",
    ];
    let t = 0;
    const interval = setInterval(() => {
      setThinkingText(texts[t % texts.length]);
      t++;
    }, 1500);

    try {
      const surfaceNum = formData.dpeData?.surface ?? 50;
      const zipcode =
        formData.address.match(/\b(\d{5})\b/)?.[1] ?? "75001";
      let atouts = {
        parquet_massif: false,
        cuisine_equipee: false,
        luminosite: false,
        balcon: false,
      };
      let aiAnalysis: Record<string, unknown> | null = null;

      if (formData.photos.length > 0) {
        const visionRes = await fetch("/api/owner-tunnel/scan-vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: formData.photos.map((p) => p.data),
          }),
        });
        if (visionRes.ok) {
          const vj = await visionRes.json();
          if (vj.atouts) atouts = vj.atouts;
        }
        const pricingRes = await fetch("/api/owner-tunnel/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zipcode,
            surface_m2: surfaceNum,
            atouts,
          }),
        });
        let loyer = 0;
        if (pricingRes.ok) {
          const pr = await pricingRes.json();
          loyer = pr.loyer_final_euros ?? 0;
        }
        const analyzeRes = await fetch("/api/analyze-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: formData.photos.map((p) => p.data),
            propertyInfo: {
              address: formData.address,
              surface: String(surfaceNum),
              rooms: "",
              dpe: formData.dpeData?.etiquette,
              furnished: formData.furnished === "meuble",
            },
          }),
        });
        if (analyzeRes.ok) {
          const ar = await analyzeRes.json();
          aiAnalysis = ar.analysis;
          if (aiAnalysis) {
            const rawFeatures = Array.isArray(aiAnalysis.features)
              ? (aiAnalysis.features as { emoji?: string; name?: string }[])
              : [];
            const features = rawFeatures.map(
              (f) => `${f.emoji || "✓"} ${f.name || ""}`
            );
            setResultData({
              loyer: loyer || 0,
              annonce:
                (aiAnalysis.ad_full_standard as string) ||
                (aiAnalysis.ad_paragraph as string) ||
                "",
              features,
            });
          }
        }
        if (!aiAnalysis && loyer > 0) {
          setResultData({
            loyer,
            annonce: `Bien ${surfaceNum}m² à ${formData.address}. Loyer marché: ${loyer}€.`,
            features: [],
          });
        }
      } else {
        const pricingRes = await fetch("/api/owner-tunnel/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zipcode,
            surface_m2: surfaceNum,
            atouts,
          }),
        });
        if (pricingRes.ok) {
          const pr = await pricingRes.json();
          setResultData({
            loyer: pr.loyer_final_euros ?? 0,
            annonce: `Bien ${surfaceNum}m² à ${formData.address}. Loyer marché estimé.`,
            features: [],
          });
        }
      }
    } catch (e) {
      console.error("Analysis error:", e);
      setResultData({
        loyer: 0,
        annonce: "Erreur lors de l'analyse. Réessayez.",
        features: [],
      });
    } finally {
      clearInterval(interval);
      setIsThinking(false);
      setShowResult(true);
    }
  };

  const summaryChips = [
    formData.address && { icon: "📍", label: formData.address.slice(0, 30) + (formData.address.length > 30 ? "…" : "") },
    formData.furnished && {
      icon: "🛋️",
      label: formData.furnished === "meuble" ? "Meublé" : "Non meublé",
    },
    formData.dpeData && {
      icon: "📄",
      label: `DPE ${formData.dpeData.etiquette || "—"} • ${formData.dpeData.surface ?? "—"} m²`,
    },
    formData.photos.length > 0 && {
      icon: "📷",
      label: `${formData.photos.length} photo(s)`,
    },
  ].filter(Boolean) as { icon: string; label: string }[];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="font-serif text-lg font-semibold text-slate-900">
                PatrimoTrust™
              </span>
              <span className="ml-2 text-xs text-slate-500">
                Mode Concierge
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-12" ref={containerRef}>
        {/* Summary chips */}
        <AnimatePresence mode="wait">
          {summaryChips.length > 0 && !showResult && (
            <motion.div
              key="chips"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-10 flex flex-wrap gap-2"
            >
              {summaryChips.map((chip, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/60"
                >
                  <span>{chip.icon}</span>
                  {chip.label}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Dashboard */}
        <AnimatePresence mode="wait">
          {showResult && resultData && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"
                >
                  <Check className="h-7 w-7 text-emerald-600" />
                </motion.div>
                <h2 className="font-serif text-2xl font-semibold text-slate-900">
                  Votre audit est prêt
                </h2>
                <p className="mt-2 text-slate-600">
                  Stratégie financière, annonce IA, sceau de confiance
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Stratégie Financière
                  </div>
                  <div className="mt-2 font-serif text-3xl font-bold text-emerald-700">
                    {resultData.loyer > 0
                      ? resultData.loyer.toLocaleString("fr-FR") + " €"
                      : "— €"}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Loyer optimisé selon localisation et DPE
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 sm:col-span-2"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Le Récit — Annonce IA
                  </div>
                  <div className="mt-3 max-h-48 overflow-y-auto text-sm leading-relaxed text-slate-700">
                    {resultData.annonce}
                  </div>
                </motion.div>
                {resultData.features.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap gap-2 sm:col-span-2"
                  >
                    {resultData.features.slice(0, 8).map((f, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
                      >
                        {f}
                      </span>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Thinking state */}
          {isThinking && !showResult && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-200 border-t-emerald-600"
              >
                <Sparkles className="h-6 w-6 text-emerald-600" />
              </motion.div>
              <p className="font-mono text-sm font-medium text-emerald-700">
                {thinkingText || "Analyse en cours..."}
              </p>
              <div className="mt-4 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Conversation flow */}
          {!showResult && !isThinking && currentStep !== "thinking" && (
            <motion.div
              key={currentStep}
              {...fadeSlide}
              className="space-y-8"
            >
              <div>
                <h2 className="font-serif text-2xl font-semibold text-slate-900 md:text-3xl">
                  {STEPS[stepIndex]?.question}
                </h2>
                {STEPS[stepIndex]?.sub && (
                  <p className="mt-2 text-slate-600">{STEPS[stepIndex].sub}</p>
                )}
              </div>

              {/* Widget: Address */}
              {currentStep === "address" && (
                <div className="relative">
                  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && confirmAddress()
                      }
                      placeholder="12 rue de la Paix, Paris"
                      className="w-full rounded-lg border-0 bg-slate-50 py-3 px-4 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500"
                    />
                    {showAddressDropdown && addressSuggestions.length > 0 && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        {addressSuggestions.map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectAddress(a.value)}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-emerald-50"
                          >
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={confirmAddress}
                    disabled={addressInput.trim().length < 3}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-medium text-amber-400 transition hover:bg-slate-800 disabled:opacity-40"
                  >
                    Continuer <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Widget: Furnished */}
              {currentStep === "furnished" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["vide", "meuble"] as const).map((opt) => (
                    <motion.button
                      key={opt}
                      type="button"
                      onClick={() => selectFurnished(opt)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex flex-col items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-8 transition hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500"
                    >
                      <Sofa
                        className={`h-12 w-12 ${
                          opt === "meuble"
                            ? "text-amber-600"
                            : "text-slate-400"
                        }`}
                      />
                      <span className="font-medium text-slate-900">
                        {opt === "meuble" ? "Meublé" : "Non meublé"}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Widget: DPE */}
              {currentStep === "dpe" && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("ring-emerald-400");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("ring-emerald-400");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("ring-emerald-400");
                      handleDpeDrop(e.dataTransfer.files);
                    }}
                    onClick={() =>
                      document.getElementById("dpeInput")?.click()
                    }
                    className="cursor-pointer rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-50/30 p-10 text-center transition hover:border-amber-500 hover:ring-1 hover:ring-amber-400"
                  >
                    <input
                      id="dpeInput"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,image/*"
                      className="hidden"
                      onChange={(e) => handleDpeDrop(e.target.files)}
                    />
                    <FileScan className="mx-auto h-12 w-12 text-amber-600" />
                    <p className="mt-3 font-medium text-slate-800">
                      Glissez votre document ici
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      PDF, JPG, PNG — Max 20 Mo
                    </p>
                    {formData.dpeData && (
                      <p className="mt-4 text-sm font-medium text-emerald-600">
                        ✓ Document analysé — {formData.dpeData.etiquette} •{" "}
                        {formData.dpeData.surface} m²
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {formData.dpeFile ? "Continuer" : "Passer cette étape"}{" "}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Widget: Photos */}
              {currentStep === "photos" && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handlePhotosDrop(e.dataTransfer.files);
                    }}
                    onClick={() =>
                      document.getElementById("photoInput")?.click()
                    }
                    className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500"
                  >
                    <input
                      id="photoInput"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => handlePhotosDrop(e.target.files)}
                    />
                    <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
                    <p className="mt-3 font-medium text-slate-800">
                      Glissez vos photos ici
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      JPG, PNG — L&apos;IA détecte parquet, marbre, luminosité
                    </p>
                  </div>
                  {formData.photos.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {formData.photos.map((p, i) => (
                        <div
                          key={i}
                          className="group relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-slate-200"
                        >
                          <img
                            src={p.data}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePhoto(i);
                            }}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={confirmPhotos}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-medium text-amber-400 transition hover:bg-slate-800"
                  >
                    Lancer l&apos;analyse et générer l&apos;annonce{" "}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
