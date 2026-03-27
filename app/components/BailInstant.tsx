"use client";

import { useState, useEffect } from "react";
import { useNotification } from "@/app/hooks/useNotification";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  User,
  Building2,
  Shield,
  Send,
  Loader2,
} from "lucide-react";

import { BailInstantProps, LeaseData, Guarantor } from "./bail-instant/types";
import { formatClausesForBackend } from "./bail-instant/clauses";
import { SmartCard, InfoRow } from "./bail-instant/SmartCard";
import { GuarantorSelector } from "./bail-instant/GuarantorSelector";
import { PDFPreview } from "./bail-instant/PDFPreview";
import { OptionalClausesSection } from "./bail-instant/OptionalClausesSection";

/**
 * Module BailInstant - Génération automatique de bail et acte de cautionnement
 * Interface split-view avec Smart Fill automatique
 */
export default function BailInstant({
  property,
  tenant,
  candidatureId,
  onGenerate,
  onSuccess,
  onError
}: BailInstantProps) {
  const notify = useNotification();
  const [leaseData, setLeaseData] = useState<LeaseData>({
    startDate: new Date(),
    rentAmount: property.rentAmount,
    chargesAmount: property.chargesAmount,
    depositAmount: Math.round(property.rentAmount * 1.5), // Dépôt de garantie standard (1.5x loyer)
    guarantorType: tenant.hasGuarantor ? (tenant.guarantorType === "VISALE" ? "VISALE" : "PHYSIQUE") : "NONE",
    guarantor: tenant.hasGuarantor ? {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      income: 0,
      profession: "",
      visaleNumber: tenant.guarantorType === "VISALE" ? "" : undefined,
    } : undefined,
    additionalClauses: "",
    selectedClauses: [],
    customClause: "",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [signatureStep, setSignatureStep] = useState<"idle" | "sending" | "sent">("idle");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Smart Fill automatique depuis les données
  useEffect(() => {
    // Hérite automatiquement des données du bien
    setLeaseData(prev => ({
      ...prev,
      rentAmount: property.rentAmount,
      chargesAmount: property.chargesAmount,
    }));
  }, [property]);

  const handleGuarantorTypeChange = (type: "VISALE" | "PHYSIQUE" | "NONE") => {
    setLeaseData(prev => ({
      ...prev,
      guarantorType: type,
      guarantor: type !== "NONE" ? {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        income: 0,
        profession: "",
        visaleNumber: type === "VISALE" ? "" : undefined,
      } : undefined,
    }));
  };

  const handleGuarantorFieldChange = (field: keyof Guarantor, value: string | number) => {
    if (!leaseData.guarantor) return;
    setLeaseData(prev => ({
      ...prev,
      guarantor: {
        ...prev.guarantor!,
        [field]: value,
      },
    }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSignatureStep("sending");

    try {
      // Appel à l'API pour créer le bail
      const response = await fetch('/api/leases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: Dans une vraie app, vous devriez inclure le token d'authentification
          // 'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          propertyId: property._id,
          candidatureId: candidatureId || tenant._id,
          startDate: leaseData.startDate.toISOString(),
          endDate: leaseData.endDate?.toISOString(),
          rentAmount: leaseData.rentAmount,
          chargesAmount: leaseData.chargesAmount,
          depositAmount: leaseData.depositAmount,
          propertyType: 'NU', // Par défaut, peut être modifié
          additionalClauses: formatClausesForBackend(leaseData.selectedClauses, leaseData.customClause),
          guarantorType: leaseData.guarantorType,
          guarantor: leaseData.guarantorType !== 'NONE' ? leaseData.guarantor : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: 'Erreur lors de la création du bail' }));
        throw new Error(errorData.msg || 'Erreur lors de la création du bail');
      }

      const result = await response.json();

      // Succès
      setSignatureStep("sent");
      setIsGenerating(false);

      // Appelle les callbacks
      if (onGenerate) {
        onGenerate(leaseData);
      }
      if (onSuccess) {
        onSuccess(result.lease);
      }
    } catch (error: any) {
      console.error('Erreur lors de la génération du bail:', error);
      setIsGenerating(false);
      setSignatureStep("idle");

      if (onError) {
        onError(error.message || 'Une erreur est survenue lors de la création du bail');
      } else {
        // Affiche une alerte par défaut
        notify.error(error.message || 'Une erreur est survenue lors de la création du bail');
      }
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold text-navy mb-2">
            Génération du Bail
          </h1>
          <p className="text-slate-600">
            Génération automatique du bail et de l'acte de cautionnement pour{" "}
            <span className="font-semibold text-navy">
              {tenant.firstName} {tenant.lastName}
            </span>
          </p>
        </div>

        {/* Split-View Layout */}
        <div className="grid grid-cols-5 gap-8">
          {/* Panneau de Configuration (Gauche - 40%) */}
          <div className="col-span-2 space-y-6">
            {/* Smart Card: Informations du Bien */}
            <SmartCard
              icon={<Building2 className="w-5 h-5" />}
              title="Informations du Bien"
              isComplete={true}
            >
              <div className="space-y-3">
                <InfoRow label="Adresse" value={property.address} />
                <InfoRow label="Loyer HC" value={`${property.rentAmount.toFixed(2)} €`} />
                <InfoRow label="Charges" value={`${property.chargesAmount.toFixed(2)} €`} />
                {property.surfaceM2 && (
                  <InfoRow label="Surface" value={`${property.surfaceM2} m²`} />
                )}
              </div>
            </SmartCard>

            {/* Smart Card: Informations du Locataire */}
            <SmartCard
              icon={<User className="w-5 h-5" />}
              title="Informations du Locataire"
              isComplete={true}
            >
              <div className="space-y-3">
                <InfoRow label="Nom complet" value={`${tenant.firstName} ${tenant.lastName}`} />
                <InfoRow label="Email" value={tenant.email} />
                <InfoRow label="Téléphone" value={tenant.phone || "Non renseigné"} />
                <InfoRow label="Revenus nets" value={`${tenant.monthlyNetIncome.toFixed(2)} €/mois`} />
                {tenant.trustAnalysis && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-600">Score PatrimoTrust™</span>
                      <span className={`font-bold ${
                        tenant.trustAnalysis.score >= 80 ? "text-emerald" :
                        tenant.trustAnalysis.score >= 60 ? "text-amber-500" :
                        "text-red-500"
                      }`}>
                        {tenant.trustAnalysis.score}/100
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </SmartCard>

            {/* Smart Card: Date d'Entrée */}
            <SmartCard
              icon={<Calendar className="w-5 h-5" />}
              title="Date d'Entrée"
              isComplete={!!leaseData.startDate}
            >
              <div className="space-y-3">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-left hover:border-emerald transition-colors bg-white"
                >
                  <div className="text-sm text-slate-600 mb-1">Date d'entrée</div>
                  <div className="font-semibold text-navy">
                    {formatDate(leaseData.startDate)}
                  </div>
                </button>
                {showDatePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-4 bg-white border border-slate-200 rounded-lg"
                  >
                    <input
                      type="date"
                      value={leaseData.startDate.toISOString().split("T")[0]}
                      onChange={(e) => setLeaseData(prev => ({
                        ...prev,
                        startDate: new Date(e.target.value),
                      }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </motion.div>
                )}
              </div>
            </SmartCard>

            {/* Smart Card: Sélecteur de Garantie */}
            <GuarantorSelector
              guarantorType={leaseData.guarantorType}
              guarantor={leaseData.guarantor}
              onChangeType={handleGuarantorTypeChange}
              onFieldChange={handleGuarantorFieldChange}
            />

            {/* Smart Card: Dépôt de Garantie */}
            <SmartCard
              icon={<Shield className="w-5 h-5" />}
              title="Dépôt de Garantie"
              isComplete={leaseData.depositAmount > 0}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-2">
                    Montant du dépôt
                  </label>
                  <input
                    type="number"
                    value={leaseData.depositAmount}
                    onChange={(e) => setLeaseData(prev => ({
                      ...prev,
                      depositAmount: parseFloat(e.target.value) || 0,
                    }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                    placeholder="Montant en euros"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Recommandé : {Math.round(property.rentAmount * 1.5).toFixed(2)} € (1.5x le loyer)
                  </div>
                </div>
              </div>
            </SmartCard>

            {/* Smart Card: Clauses Optionnelles */}
            <OptionalClausesSection
              selectedClauses={leaseData.selectedClauses}
              customClause={leaseData.customClause}
              onClauseToggle={(clauseId) => {
                setLeaseData(prev => ({
                  ...prev,
                  selectedClauses: prev.selectedClauses.includes(clauseId)
                    ? prev.selectedClauses.filter(id => id !== clauseId)
                    : [...prev.selectedClauses, clauseId]
                }));
              }}
              onCustomClauseChange={(text) => {
                setLeaseData(prev => ({
                  ...prev,
                  customClause: text
                }));
              }}
            />

            {/* Bouton d'Action Luxe */}
            <motion.button
              onClick={handleGenerate}
              disabled={isGenerating || signatureStep === "sent"}
              className="w-full py-4 px-6 bg-navy text-white rounded-xl font-semibold text-lg hover:bg-navy/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {signatureStep === "idle" && (
                <>
                  <Send className="w-5 h-5" />
                  Lancer la signature électronique
                </>
              )}
              {signatureStep === "sending" && (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Envoi des invitations...
                </>
              )}
              {signatureStep === "sent" && (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Invitations envoyées
                </>
              )}
            </motion.button>

            {/* Animation des Étapes de Signature */}
            <AnimatePresence>
              {signatureStep === "sending" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-6 bg-white border border-slate-200 rounded-xl space-y-4"
                >
                  <div className="text-sm font-semibold text-navy mb-4">
                    Envoi des invitations en cours...
                  </div>
                  {["Locataire", "Garant", "Vous"].map((step, index) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.3 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === 0 ? "bg-emerald text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {index === 0 ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                      </div>
                      <span className="text-sm text-slate-700">{step}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Prévisualisation PDF (Droite - 60%) */}
          <div className="col-span-3">
            <PDFPreview
              property={property}
              tenant={tenant}
              leaseData={leaseData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
