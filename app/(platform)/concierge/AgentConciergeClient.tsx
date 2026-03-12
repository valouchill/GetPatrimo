"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Paperclip,
  Send,
  Sparkles,
  Check,
  Loader2,
  TrendingUp,
  Briefcase,
  Plane,
  Home,
  User,
} from "lucide-react";
import type { PropertyData } from "@/lib/owner-tunnel/property-data-schema";
import { INITIAL_PROPERTY_DATA } from "@/lib/owner-tunnel/property-data-schema";

type ResultData = {
  loyer: number;
  annonce: string;
  features: string[];
  loyer_base?: number;
  primes_valorisation?: { raison: string; montant: number }[];
  profil_cible_titre?: string;
  profil_cible_explication?: string;
  note_synthese?: string;
};

function DossierStrategiqueView({ resultData }: { resultData: ResultData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"strategie" | "ciblage" | "rayonnement">("strategie");

  const getProfilIcon = () => {
    const t = (resultData.profil_cible_titre ?? "").toLowerCase();
    if (t.includes("cadre") || t.includes("actif")) return Briefcase;
    if (t.includes("expat") || t.includes("international")) return Plane;
    if (t.includes("famille")) return Home;
    return User;
  };
  const ProfilIcon = getProfilIcon();

  return (
    <motion.div
      key="dossier"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-xl"
    >
      <div className="mb-8 flex justify-center gap-1 border-b border-slate-200">
        {[
          { id: "strategie" as const, label: "Stratégie Financière" },
          { id: "ciblage" as const, label: "Ciblage Locataire" },
          { id: "rayonnement" as const, label: "Outils de Rayonnement" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-6 pb-3 text-sm font-medium transition ${
              activeTab === tab.id ? "text-emerald-700" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.span
                layoutId="underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600"
              />
            )}
          </button>
        ))}
      </div>

      {activeTab === "strategie" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
              Loyer recommandé
            </p>
            <p className="mt-2 font-serif text-5xl font-bold text-emerald-700">
              {resultData.loyer > 0
                ? resultData.loyer.toLocaleString("fr-FR") + " €"
                : "— €"}
              <span className="text-2xl font-normal text-slate-400">/mois</span>
            </p>
          </div>

          {(resultData.primes_valorisation?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Facteurs de valorisation
              </p>
              <ul className="space-y-2">
                {resultData.primes_valorisation!.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      {p.raison}
                    </span>
                    <span className="font-semibold text-emerald-600">
                      +{p.montant} €
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resultData.note_synthese && (
            <div className="rounded-r-lg border-l-4 border-emerald-500 bg-slate-50 p-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {resultData.note_synthese}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "ciblage" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/50 p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <ProfilIcon className="h-8 w-8 text-emerald-700" />
            </div>
            <h3 className="text-center font-serif text-xl font-semibold text-slate-900">
              {resultData.profil_cible_titre || "Profil Premium"}
            </h3>
            <p className="mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-600">
              {resultData.profil_cible_explication ||
                "Ce bien attire un profil exigeant, en phase avec le standing des prestations et le loyer proposé."}
            </p>
          </div>
        </motion.div>
      )}

      {activeTab === "rayonnement" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Le Récit — Annonce IA
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-700">
              {resultData.annonce}
            </div>
          </div>
          {resultData.features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resultData.features.slice(0, 8).map((f, i) => (
                <span
                  key={i}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => router.push("/dashboard/owner")}
          className="rounded-xl bg-slate-900 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-slate-800 hover:shadow-xl"
        >
          Valider la Stratégie & Ouvrir le Coffre-Fort
        </button>
      </div>
    </motion.div>
  );
}

export default function AgentConciergeClient() {
  const [propertyData, setPropertyData] =
    useState<PropertyData>(INITIAL_PROPERTY_DATA);
  const [agentQuestion, setAgentQuestion] = useState(
    "Où se situe le joyau que vous souhaitez valoriser ?"
  );
  const [streamingText, setStreamingText] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [resultData, setResultData] = useState<{
    loyer: number;
    annonce: string;
    features: string[];
    loyer_base?: number;
    primes_valorisation?: { raison: string; montant: number }[];
    profil_cible_titre?: string;
    profil_cible_explication?: string;
    note_synthese?: string;
  } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [photos, setPhotos] = useState<{ data: string; name: string }[]>([]);
  const [dpeData, setDpeData] = useState<{ surface?: number; etiquette?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const sendToAgent = useCallback(
    async (userMessage: string, overrideData?: Partial<PropertyData>) => {
      if (!userMessage.trim() || isProcessing || isComplete) return;
      setIsProcessing(true);
      setQuickReplies(null);
      setStreamingText("");
      const newMessages = [...messages, { role: "user" as const, text: userMessage }];
      setMessages(newMessages);
      setUserInput("");

      let pd = { ...propertyData, ...overrideData };
      if (dpeData?.surface) pd = { ...pd, surface_m2: dpeData.surface };
      if (dpeData?.etiquette)
        pd = { ...pd, etiquette_dpe: dpeData.etiquette as PropertyData["etiquette_dpe"], has_dpe_document: true };
      if (photos.length > 0) pd = { ...pd, photos_count: photos.length };

      try {
        const res = await fetch("/api/owner-tunnel/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyData: pd,
            userMessage,
            messages: newMessages.slice(0, -1),
            stream: true,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erreur agent");
        }
        if (!res.body) throw new Error("Pas de flux");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let currentEvent = "";
        let currentData = "";
        let accumulatedText = "";

        const handleDone = (data: string) => {
          try {
            const parsed = JSON.parse(data) as { propertyData?: PropertyData; isComplete?: boolean };
            setPropertyData(parsed.propertyData ?? pd);
            setStreamingText("");
            setMessages((m) => [...m, { role: "agent", text: accumulatedText }]);
            setAgentQuestion(accumulatedText || agentQuestion);

            if (parsed.isComplete) {
              setIsComplete(true);
              setAgentQuestion(
                accumulatedText ||
                  "Merci pour ces détails, votre bien a un potentiel exceptionnel. Laissez-moi quelques secondes pour rédiger une annonce à sa hauteur..."
              );
              launchFinalAnalysis(parsed.propertyData ?? pd);
            }
          } catch {
            setAgentQuestion("Une erreur est survenue. Pouvez-vous reformuler ?");
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const block of parts) {
            for (const line of block.split("\n")) {
              if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
              else if (line.startsWith("data: ")) currentData = line.slice(6);
            }
            if (!currentEvent || !currentData) continue;

            if (currentEvent === "token") {
              try {
                const chunk = JSON.parse(currentData) as string;
                accumulatedText += chunk;
                setStreamingText(accumulatedText);
              } catch {
                /* */
              }
            } else if (currentEvent === "quick_replies") {
              try {
                setQuickReplies(JSON.parse(currentData) as string[]);
              } catch {
                /* */
              }
            } else if (currentEvent === "done") {
              handleDone(currentData);
            } else if (currentEvent === "error") {
              try {
                const err = JSON.parse(currentData);
                setAgentQuestion(err.error ?? "Erreur");
              } catch {
                setAgentQuestion("Erreur");
              }
            }
            currentEvent = "";
            currentData = "";
          }
        }

        if (buf.trim()) {
          for (const line of buf.split("\n")) {
            if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
            else if (line.startsWith("data: ")) currentData = line.slice(6);
          }
          if (currentEvent === "done" && currentData) handleDone(currentData);
        }
      } catch (e) {
        console.error("Agent:", e);
        setAgentQuestion(e instanceof Error ? e.message : "Une erreur est survenue. Pouvez-vous reformuler ?");
      } finally {
        setIsProcessing(false);
        setQuickReplies(null);
      }
    },
    [propertyData, dpeData, photos.length, isProcessing, isComplete, messages, agentQuestion]
  );

  const launchFinalAnalysis = async (pd: PropertyData) => {
    await new Promise((r) => setTimeout(r, 1500));
    setShowResult(true);
    const surfaceNum = pd.surface_m2 ?? 50;
    const zipcode =
      (pd.address ?? "").match(/\b(\d{5})\b/)?.[1] ?? "75001";
    const atouts = {
      parquet_massif: false,
      cuisine_equipee: false,
      luminosite: false,
      balcon: false,
    };
    try {
      if (photos.length > 0) {
        const visionRes = await fetch("/api/owner-tunnel/scan-vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: photos.map((p) => p.data) }),
        });
        if (visionRes.ok) {
          const vj = await visionRes.json();
          if (vj.atouts) Object.assign(atouts, vj.atouts);
        }
      }

      const dossierRes = await fetch("/api/owner-tunnel/dossier-strategique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipcode,
          surface_m2: surfaceNum,
          atouts,
          address: pd.address,
          furnished: pd.furnished === "meuble",
          etiquette_dpe: pd.etiquette_dpe ?? undefined,
        }),
      });

      let loyer = 0;
      let dossier: {
        loyer_base?: number;
        primes_valorisation?: { raison: string; montant: number }[];
        profil_cible_titre?: string;
        profil_cible_explication?: string;
        note_synthese?: string;
      } = {};
      if (dossierRes.ok) {
        const dj = await dossierRes.json();
        loyer = dj.loyer_recommande ?? 0;
        dossier = {
          loyer_base: dj.loyer_base,
          primes_valorisation: dj.primes_valorisation,
          profil_cible_titre: dj.profil_cible_titre,
          profil_cible_explication: dj.profil_cible_explication,
          note_synthese: dj.note_synthese,
        };
      }

      if (photos.length > 0) {
        const analyzeRes = await fetch("/api/analyze-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: photos.map((p) => p.data),
            propertyInfo: {
              address: pd.address,
              surface: String(surfaceNum),
              rooms: String(pd.rooms ?? ""),
              dpe: pd.etiquette_dpe,
              furnished: pd.furnished === "meuble",
            },
          }),
        });
        if (analyzeRes.ok) {
          const ar = await analyzeRes.json();
          const ai = ar.analysis;
          if (ai) {
            const rawFeatures = Array.isArray(ai.features)
              ? (ai.features as { emoji?: string; name?: string }[])
              : [];
            setResultData({
              loyer,
              annonce: (ai.ad_full_standard || ai.ad_paragraph) ?? "",
              features: rawFeatures.map((f) => `${f.emoji || "✓"} ${f.name || ""}`),
              ...dossier,
            });
            return;
          }
        }
      }
      setResultData({
        loyer,
        annonce: `Bien ${surfaceNum}m² à ${pd.address}. Loyer marché recommandé: ${loyer}€.`,
        features: [],
        ...dossier,
      });
    } catch (e) {
      console.error("Analysis:", e);
      setResultData({
        loyer: 0,
        annonce: "Erreur lors de l'analyse.",
        features: [],
        note_synthese: "Une erreur est survenue lors du calcul de la stratégie.",
      });
    }
  };

  const handleSubmit = () => {
    sendToAgent(userInput.trim());
  };

  const toggleListening = () => {
    const Win = window as unknown as { SpeechRecognition?: new () => Record<string, unknown>; webkitSpeechRecognition?: new () => Record<string, unknown> };
    const SpeechRecognition = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SpeechRecognition() as Record<string, unknown>;
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: unknown) => {
      const ev = e as { results: Iterable<{ 0: { transcript: string } }> };
      const t = Array.from(ev.results)
        .map((r) => (r as { 0: { transcript: string } })[0]?.transcript ?? "")
        .join("");
      setUserInput((prev) => prev + t);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec as { stop: () => void };
    (rec.start as () => void)();
    setIsListening(true);
  };

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      if (file.type.includes("pdf") || file.type.startsWith("image/")) {
        if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
          setIsAnalyzingFile(true);
          const fd = new FormData();
          fd.append("file", file);
          fetch("/api/owner-tunnel/scan-dpe", { method: "POST", body: fd })
            .then((r) => r.json())
            .then((res) => {
              if (res.dpe) {
                const surface = res.dpe.surface_habitable_m2 ?? null;
                const etiquette = res.dpe.etiquette_energie ?? null;
                setDpeData({ surface, etiquette });
                setPropertyData((p) => ({
                  ...p,
                  surface_m2: surface ?? p.surface_m2,
                  etiquette_dpe: etiquette ?? p.etiquette_dpe,
                  has_dpe_document: true,
                }));
                sendToAgent("J'ai déposé mon document DPE.", {
                  surface_m2: surface,
                  etiquette_dpe: etiquette,
                  has_dpe_document: true,
                });
              }
            })
            .catch(console.warn)
            .finally(() => setIsAnalyzingFile(false));
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = e.target?.result as string;
            setPhotos((p) => {
              const next = [...p, { data, name: file.name }].slice(0, 10);
              setPropertyData((prev) => ({ ...prev, photos_count: next.length }));
              return next;
            });
          };
          reader.readAsDataURL(file);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [sendToAgent]
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Halo IA */}
      <div className="flex flex-col items-center px-6 pt-12 pb-8">
        <motion.div
          animate={
            isProcessing
              ? {
                  opacity: [0.7, 1, 0.7],
                  boxShadow: [
                    "0 0 30px 8px rgba(16,185,129,0.2)",
                    "0 0 40px 12px rgba(16,185,129,0.4)",
                    "0 0 30px 8px rgba(16,185,129,0.2)",
                  ],
                }
              : { opacity: 1 }
          }
          transition={{ duration: 2, repeat: isProcessing ? Infinity : 0 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-emerald-200"
        >
          {isProcessing ? (
            <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
          ) : (
            <Sparkles className="h-7 w-7 text-emerald-600" />
          )}
        </motion.div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          Expert PatrimoTrust
        </p>
      </div>

      {/* Zone texte IA */}
      <div
        className={`mx-auto flex flex-1 flex-col justify-center px-6 py-8 ${
          showResult ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <AnimatePresence mode="wait">
          {showResult && resultData ? (
            <DossierStrategiqueView resultData={resultData} />
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="mx-auto max-w-2xl font-serif text-2xl font-semibold text-slate-900">
                  {(streamingText || agentQuestion)}
                  {isProcessing && !streamingText && (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-emerald-500" />
                  )}
                </h2>
                {(quickReplies?.length ?? 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex flex-wrap justify-center gap-3"
                  >
                    {quickReplies!.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => sendToAgent(opt)}
                        disabled={isProcessing || isComplete}
                        className="rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
              {isAnalyzingFile && (
                <p className="text-center text-xs text-slate-500">
                  Analyse du document en cours...
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input universel flottant */}
      {!showResult && (
        <div className="sticky bottom-0 left-0 right-0 p-4 pb-8">
          <div
            className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-xl backdrop-blur-xl"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files);
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png,image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-700"
                title="Joindre DPE ou photo"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Répondez ici..."
                className="flex-1 rounded-xl border-0 bg-slate-50 py-3 px-4 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500"
                disabled={isProcessing || isComplete}
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
                  isListening
                    ? "bg-rose-100 text-rose-600"
                    : "bg-gradient-to-br from-amber-100 to-emerald-100 text-emerald-700 hover:from-amber-200 hover:to-emerald-200"
                }`}
                title={isListening ? "Arrêter" : "Dicter"}
              >
                {isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!userInput.trim() || isProcessing || isComplete}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">
              Ou glissez un document DPE / photo via le trombone
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
