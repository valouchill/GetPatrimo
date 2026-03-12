"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  CheckCircle2, 
  User, 
  Building2, 
  Shield, 
  Send, 
  Loader2,
  Settings,
  Wifi,
  Wind,
  Droplets,
  Home,
  Sparkles,
  FileText,
  Plus
} from "lucide-react";

interface Property {
  _id: string;
  name: string;
  address: string;
  addressLine: string;
  zipCode: string;
  city: string;
  rentAmount: number;
  chargesAmount: number;
  surfaceM2?: number;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  monthlyNetIncome: number;
  contractType: string;
  hasGuarantor: boolean;
  guarantorType: string;
  trustAnalysis?: {
    score: number;
    status: string;
  };
}

interface Guarantor {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  income: number;
  profession: string;
  visaleNumber?: string;
}

interface Clause {
  id: string;
  title: string;
  description: string;
  category: "TECH" | "LUXE" | "ENTRETIEN" | "USAGE";
  content: string;
  isPremium?: boolean;
}

interface BailInstantProps {
  property: Property;
  tenant: Tenant;
  candidatureId?: string;
  onGenerate?: (leaseData: LeaseData) => void;
  onSuccess?: (lease: any) => void;
  onError?: (error: string) => void;
}

interface LeaseData {
  startDate: Date;
  endDate?: Date;
  rentAmount: number;
  chargesAmount: number;
  depositAmount: number;
  guarantorType: "VISALE" | "PHYSIQUE" | "NONE";
  guarantor?: Guarantor;
  additionalClauses: string;
  selectedClauses: string[]; // IDs des clauses sélectionnées
  customClause: string; // Clause libre
}

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
        alert(`Erreur: ${error.message || 'Une erreur est survenue lors de la création du bail'}`);
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

/**
 * Smart Card - Carte interactive pour la configuration
 */
interface SmartCardProps {
  icon: React.ReactNode;
  title: string;
  isComplete: boolean;
  children: React.ReactNode;
}

function SmartCard({ icon, title, isComplete, children }: SmartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isComplete ? "bg-emerald/10 text-emerald" : "bg-slate-100 text-slate-600"
          }`}>
            {icon}
          </div>
          <h3 className="font-semibold text-navy">{title}</h3>
        </div>
        {isComplete && (
          <CheckCircle2 className="w-5 h-5 text-emerald" />
        )}
      </div>
      {children}
    </motion.div>
  );
}

/**
 * Info Row - Ligne d'information
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-navy">{value}</span>
    </div>
  );
}

/**
 * Sélecteur de Garantie Intelligent
 */
interface GuarantorSelectorProps {
  guarantorType: "VISALE" | "PHYSIQUE" | "NONE";
  guarantor?: Guarantor;
  onChangeType: (type: "VISALE" | "PHYSIQUE" | "NONE") => void;
  onFieldChange: (field: keyof Guarantor, value: string | number) => void;
}

function GuarantorSelector({
  guarantorType,
  guarantor,
  onChangeType,
  onFieldChange,
}: GuarantorSelectorProps) {
  return (
    <SmartCard
      icon={<Shield className="w-5 h-5" />}
      title="Type de Garantie"
      isComplete={guarantorType !== "NONE" && !!guarantor}
    >
      <div className="space-y-4">
        {/* Sélection du type */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onChangeType("VISALE")}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              guarantorType === "VISALE"
                ? "border-emerald bg-emerald/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-semibold text-sm text-navy mb-1">Visale</div>
            <div className="text-xs text-slate-500">Garantie publique</div>
          </button>
          <button
            onClick={() => onChangeType("PHYSIQUE")}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              guarantorType === "PHYSIQUE"
                ? "border-emerald bg-emerald/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-semibold text-sm text-navy mb-1">Physique</div>
            <div className="text-xs text-slate-500">Garant personne</div>
          </button>
          <button
            onClick={() => onChangeType("NONE")}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              guarantorType === "NONE"
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-semibold text-sm text-slate-600 mb-1">Aucun</div>
            <div className="text-xs text-slate-500">Sans garant</div>
          </button>
        </div>

        {/* Formulaire Visale */}
        {guarantorType === "VISALE" && guarantor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3 pt-4 border-t border-slate-200"
          >
            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Numéro de Visa
              </label>
              <input
                type="text"
                value={guarantor.visaleNumber || ""}
                onChange={(e) => onFieldChange("visaleNumber", e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                placeholder="Ex: VISALE123456789"
              />
            </div>
          </motion.div>
        )}

        {/* Formulaire Garant Physique */}
        {guarantorType === "PHYSIQUE" && guarantor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3 pt-4 border-t border-slate-200"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Prénom</label>
                <input
                  type="text"
                  value={guarantor.firstName}
                  onChange={(e) => onFieldChange("firstName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Nom</label>
                <input
                  type="text"
                  value={guarantor.lastName}
                  onChange={(e) => onFieldChange("lastName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Email</label>
              <input
                type="email"
                value={guarantor.email}
                onChange={(e) => onFieldChange("email", e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Revenus mensuels nets</label>
              <input
                type="number"
                value={guarantor.income || ""}
                onChange={(e) => onFieldChange("income", parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                placeholder="Montant en euros"
              />
            </div>
            {/* Carte Résumé du Garant */}
            {guarantor.firstName && guarantor.lastName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-emerald/5 border border-emerald/20 rounded-lg"
              >
                <div className="text-xs text-slate-600 mb-2">Résumé du garant</div>
                <div className="font-semibold text-navy">
                  {guarantor.firstName} {guarantor.lastName}
                </div>
                {guarantor.income > 0 && (
                  <div className="text-sm text-slate-600 mt-1">
                    Revenus certifiés : {guarantor.income.toFixed(2)} €/mois
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </SmartCard>
  );
}

/**
 * Prévisualisation PDF - Mock stylisé du document
 */
interface PDFPreviewProps {
  property: Property;
  tenant: Tenant;
  leaseData: LeaseData;
}

function PDFPreview({ property, tenant, leaseData }: PDFPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header PDF */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <div className="text-sm text-slate-600">Bail de location - Prévisualisation</div>
      </div>

      {/* Contenu du Document */}
      <div className="p-12 space-y-8 min-h-[800px]">
        {/* Titre */}
        <div className="text-center border-b-2 border-navy pb-6">
          <h1 className="text-3xl font-serif font-bold text-navy mb-2">
            CONTRAT DE LOCATION
          </h1>
          <p className="text-slate-600">Bail de location d'habitation</p>
        </div>

        {/* Informations du Bien */}
        <section>
          <h2 className="text-xl font-serif font-semibold text-navy mb-4">
            Article 1 - Objet du contrat
          </h2>
          <div className="space-y-2 text-slate-700 leading-relaxed">
            <p>
              Le présent contrat de location a pour objet la location d'un bien situé à l'adresse suivante :
            </p>
            <p className="font-semibold text-navy pl-4 border-l-4 border-emerald">
              {property.address}
            </p>
            <p className="mt-4">
              D'une surface de <span className="font-semibold">{property.surfaceM2 || "N/A"} m²</span>,
              pour un loyer hors charges de <span className="font-semibold">{property.rentAmount.toFixed(2)} €</span>
              {property.chargesAmount > 0 && (
                <> et des charges de <span className="font-semibold">{property.chargesAmount.toFixed(2)} €</span></>
              )}.
            </p>
          </div>
        </section>

        {/* Informations du Locataire */}
        <section>
          <h2 className="text-xl font-serif font-semibold text-navy mb-4">
            Article 2 - Locataire
          </h2>
          <div className="space-y-2 text-slate-700">
            <p>
              <span className="font-semibold">Nom :</span> {tenant.lastName}
            </p>
            <p>
              <span className="font-semibold">Prénom :</span> {tenant.firstName}
            </p>
            <p>
              <span className="font-semibold">Email :</span> {tenant.email}
            </p>
            {tenant.phone && (
              <p>
                <span className="font-semibold">Téléphone :</span> {tenant.phone}
              </p>
            )}
          </div>
        </section>

        {/* Durée et Dates */}
        <section>
          <h2 className="text-xl font-serif font-semibold text-navy mb-4">
            Article 3 - Durée et dates
          </h2>
          <div className="space-y-2 text-slate-700">
            <p>
              Le présent bail prend effet le <span className="font-semibold text-navy">
                {leaseData.startDate.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>.
            </p>
            <p>
              Dépôt de garantie : <span className="font-semibold">{leaseData.depositAmount.toFixed(2)} €</span>
            </p>
          </div>
        </section>

        {/* Garantie */}
        {leaseData.guarantorType !== "NONE" && (
          <section>
            <h2 className="text-xl font-serif font-semibold text-navy mb-4">
              Article 4 - Acte de Cautionnement
            </h2>
            <div className="space-y-2 text-slate-700">
              {leaseData.guarantorType === "VISALE" && (
                <p>
                  Garantie Visale : Numéro <span className="font-semibold">
                    {leaseData.guarantor?.visaleNumber || "[À compléter]"}
                  </span>
                </p>
              )}
              {leaseData.guarantorType === "PHYSIQUE" && leaseData.guarantor && (
                <div>
                  <p className="font-semibold mb-2">Garant :</p>
                  <p className="pl-4">
                    {leaseData.guarantor.firstName} {leaseData.guarantor.lastName}
                    {leaseData.guarantor.income > 0 && (
                      <> - Revenus : {leaseData.guarantor.income.toFixed(2)} €/mois</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Clauses Additionnelles */}
        {(() => {
          const hasClauses = leaseData.selectedClauses.length > 0 || leaseData.customClause.trim().length > 0;
          if (!hasClauses) return null;
          
          const allClauses = getAllClauses();
          
          return (
            <section>
              <h2 className="text-xl font-serif font-semibold text-navy mb-4">
                Article 5 - Clauses additionnelles
              </h2>
              <div className="space-y-4 text-slate-700">
                <AnimatePresence mode="popLayout">
                  {leaseData.selectedClauses.map((clauseId) => {
                    const clause = allClauses.find(c => c.id === clauseId);
                    if (!clause) return null;
                    
                    return (
                      <motion.div
                        key={clauseId}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 bg-gradient-to-r from-slate-50 to-white border-l-4 border-emerald rounded-r-lg shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold text-navy">{clause.title}</h3>
                          {clause.isPremium && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-white flex-shrink-0">
                              Premium
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700">{clause.content}</p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                
                {leaseData.customClause.trim().length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-slate-50 border-l-4 border-navy rounded-r-lg"
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-line">{leaseData.customClause}</p>
                  </motion.div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Espace pour signatures */}
        <section className="mt-16 pt-8 border-t-2 border-slate-300">
          <div className="grid grid-cols-2 gap-12">
            <div className="text-center">
              <div className="h-24 border-2 border-dashed border-slate-300 rounded-lg mb-2 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Signature Locataire</span>
              </div>
            </div>
            <div className="text-center">
              <div className="h-24 border-2 border-dashed border-slate-300 rounded-lg mb-2 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Signature Propriétaire</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

/**
 * Liste complète des clauses optionnelles disponibles
 */
function getAllClauses(): Clause[] {
  return [
    // Équipements Tech
    {
      id: "clause-wifi",
      title: "Wi-Fi Haut Débit",
      description: "Connexion internet fibre incluse",
      category: "TECH",
      content: "Le logement dispose d'une connexion internet haut débit (fibre optique) incluse dans les charges. Le locataire s'engage à utiliser cette connexion de manière raisonnable et à ne pas effectuer d'activités illégales.",
      isPremium: true
    },
    {
      id: "clause-climatisation",
      title: "Climatisation Réversible",
      description: "Système de climatisation réversible",
      category: "TECH",
      content: "Le logement est équipé d'un système de climatisation réversible. L'entretien et la maintenance sont à la charge du locataire. En cas de panne, le locataire doit en informer le propriétaire dans les 48 heures.",
      isPremium: true
    },
    {
      id: "clause-ventilation",
      title: "Ventilation Mécanique",
      description: "VMC double flux avec récupération de chaleur",
      category: "TECH",
      content: "Le logement dispose d'une ventilation mécanique contrôlée (VMC) double flux avec récupération de chaleur. Le locataire s'engage à maintenir les bouches d'aération dégagées et à signaler tout dysfonctionnement.",
      isPremium: true
    },
    {
      id: "clause-domotique",
      title: "Domotique Intelligente",
      description: "Système domotique pour la gestion du logement",
      category: "TECH",
      content: "Le logement est équipé d'un système domotique permettant la gestion à distance de l'éclairage, du chauffage et de la sécurité. Le locataire s'engage à utiliser ce système conformément aux instructions fournies.",
      isPremium: true
    },
    
    // Matériaux & Luxe
    {
      id: "clause-parquet",
      title: "Parquet Massif",
      description: "Parquet en bois massif de qualité",
      category: "LUXE",
      content: "Le logement dispose d'un parquet en bois massif de qualité. Le locataire s'engage à entretenir ce parquet selon les recommandations du propriétaire et à utiliser des protections adaptées sous les meubles.",
      isPremium: true
    },
    {
      id: "clause-electromenager",
      title: "Électroménager Premium",
      description: "Électroménager haut de gamme inclus",
      category: "LUXE",
      content: "Le logement est équipé d'électroménager haut de gamme (lave-linge, lave-vaisselle, réfrigérateur). Le locataire s'engage à utiliser ces équipements conformément aux instructions et à signaler toute anomalie.",
      isPremium: true
    },
    {
      id: "clause-securite",
      title: "Système de Sécurité",
      description: "Alarme et vidéosurveillance",
      category: "LUXE",
      content: "Le logement est équipé d'un système d'alarme et de vidéosurveillance. Le locataire s'engage à activer ce système en cas d'absence prolongée et à respecter les consignes de sécurité.",
      isPremium: true
    },
    
    // Entretien Système
    {
      id: "clause-chaudiere",
      title: "Entretien Chaudière",
      description: "Entretien annuel de la chaudière inclus",
      category: "ENTRETIEN",
      content: "L'entretien annuel de la chaudière est pris en charge par le propriétaire. Le locataire doit permettre l'accès aux techniciens pour les interventions programmées et signaler toute anomalie.",
    },
    {
      id: "clause-ascenseur",
      title: "Ascenseur",
      description: "Ascenseur avec maintenance incluse",
      category: "ENTRETIEN",
      content: "Le logement dispose d'un ascenseur dont la maintenance est assurée par le propriétaire. Le locataire s'engage à utiliser l'ascenseur de manière responsable et à signaler tout dysfonctionnement.",
    },
    {
      id: "clause-volets",
      title: "Volets Automatiques",
      description: "Volets roulants électriques",
      category: "ENTRETIEN",
      content: "Le logement est équipé de volets roulants électriques. Le locataire s'engage à utiliser ces volets de manière raisonnable et à signaler toute panne dans les 48 heures.",
    },
    
    // Usage & Vie
    {
      id: "clause-animaux",
      title: "Animaux Autorisés",
      description: "Autorisation d'animaux de compagnie",
      category: "USAGE",
      content: "Les animaux de compagnie sont autorisés sous réserve d'une déclaration préalable au propriétaire. Le locataire s'engage à maintenir les lieux propres et à réparer tout dommage causé par l'animal.",
    },
    {
      id: "clause-teletravail",
      title: "Télétravail Autorisé",
      description: "Autorisation de télétravail à domicile",
      category: "USAGE",
      content: "Le télétravail est autorisé dans le logement. Le locataire s'engage à utiliser le logement à des fins professionnelles de manière raisonnable et à respecter les règles de copropriété.",
    },
    {
      id: "clause-parking",
      title: "Place de Parking",
      description: "Place de parking privée incluse",
      category: "USAGE",
      content: "Une place de parking privée est mise à disposition du locataire. Cette place est réservée exclusivement au véhicule du locataire et ne peut être sous-louée sans autorisation écrite du propriétaire.",
      isPremium: true
    },
  ];
}

/**
 * Formate les clauses pour l'envoi au backend
 */
function formatClausesForBackend(selectedClauses: string[], customClause: string): string {
  const allClauses = getAllClauses();
  const clausesText: string[] = [];
  
  selectedClauses.forEach((clauseId) => {
    const clause = allClauses.find(c => c.id === clauseId);
    if (clause) {
      clausesText.push(`${clause.title}\n${clause.content}`);
    }
  });
  
  if (customClause.trim().length > 0) {
    clausesText.push(customClause);
  }
  
  return clausesText.join("\n\n");
}

/**
 * Composant Section Clauses Optionnelles
 */
interface OptionalClausesSectionProps {
  selectedClauses: string[];
  customClause: string;
  onClauseToggle: (clauseId: string) => void;
  onCustomClauseChange: (text: string) => void;
}

function OptionalClausesSection({
  selectedClauses,
  customClause,
  onClauseToggle,
  onCustomClauseChange
}: OptionalClausesSectionProps) {
  const allClauses = getAllClauses();
  
  const clausesByCategory = {
    TECH: allClauses.filter(c => c.category === "TECH"),
    LUXE: allClauses.filter(c => c.category === "LUXE"),
    ENTRETIEN: allClauses.filter(c => c.category === "ENTRETIEN"),
    USAGE: allClauses.filter(c => c.category === "USAGE"),
  };

  const categoryIcons = {
    TECH: <Wifi className="w-4 h-4" />,
    LUXE: <Sparkles className="w-4 h-4" />,
    ENTRETIEN: <Droplets className="w-4 h-4" />,
    USAGE: <Home className="w-4 h-4" />,
  };

  const categoryColors = {
    TECH: "text-blue-600 bg-blue-50",
    LUXE: "text-amber-600 bg-amber-50",
    ENTRETIEN: "text-emerald-600 bg-emerald-50",
    USAGE: "text-slate-600 bg-slate-50",
  };

  const categoryLabels = {
    TECH: "Équipements Tech",
    LUXE: "Matériaux & Luxe",
    ENTRETIEN: "Entretien Système",
    USAGE: "Usage & Vie",
  };

  return (
    <SmartCard
      icon={<Settings className="w-5 h-5" />}
      title="Clauses Optionnelles"
      isComplete={selectedClauses.length > 0 || customClause.trim().length > 0}
    >
      <div className="space-y-6">
        {/* Catégories de clauses */}
        {Object.entries(clausesByCategory).map(([category, clauses]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <div className="p-1.5 rounded bg-slate-100 text-slate-600">
                {categoryIcons[category as keyof typeof categoryIcons]}
              </div>
              {categoryLabels[category as keyof typeof categoryLabels]}
            </div>
            <div className="space-y-2 pl-8">
              {clauses.map((clause) => (
                <ClauseToggle
                  key={clause.id}
                  clause={clause}
                  isSelected={selectedClauses.includes(clause.id)}
                  onToggle={() => onClauseToggle(clause.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Clause Libre */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-slate-600" />
            <label className="text-sm font-semibold text-slate-700">
              Clause Libre
            </label>
          </div>
          <textarea
            value={customClause}
            onChange={(e) => onCustomClauseChange(e.target.value)}
            placeholder="Ajoutez votre propre clause personnalisée..."
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald resize-none"
            rows={4}
          />
          {customClause.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-center gap-2 text-xs text-emerald"
            >
              <CheckCircle2 className="w-3 h-3" />
              Clause personnalisée ajoutée
            </motion.div>
          )}
        </div>
      </div>
    </SmartCard>
  );
}

/**
 * Composant Clause Toggle - Carte interactive pour chaque clause
 */
interface ClauseToggleProps {
  clause: Clause;
  isSelected: boolean;
  onToggle: () => void;
}

function ClauseToggle({ clause, isSelected, onToggle }: ClauseToggleProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={`w-full text-left p-3 border rounded-lg transition-all ${
        isSelected
          ? "border-emerald bg-emerald/5 shadow-sm"
          : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
      }`}
      whileHover={{ scale: 1.005, y: -1 }}
      whileTap={{ scale: 0.995 }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox stylisée */}
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
          isSelected
            ? "border-emerald bg-emerald shadow-sm"
            : "border-slate-300 bg-white"
        }`}>
          {isSelected && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
        </div>
        
        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className={`font-semibold text-sm ${
              isSelected ? "text-navy" : "text-slate-700"
            }`}>
              {clause.title}
            </h4>
            {clause.isPremium && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white shadow-sm"
              >
                Premium
              </motion.span>
            )}
          </div>
          <p className={`text-xs leading-relaxed ${
            isSelected ? "text-slate-600" : "text-slate-500"
          }`}>
            {clause.description}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
