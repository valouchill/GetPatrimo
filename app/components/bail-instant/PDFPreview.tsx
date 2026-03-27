"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Property, Tenant, LeaseData } from "./types";
import { getAllClauses, formatClausesForBackend } from "./clauses";

/**
 * Prévisualisation PDF - Mock stylisé du document
 */
export interface PDFPreviewProps {
  property: Property;
  tenant: Tenant;
  leaseData: LeaseData;
}

export function PDFPreview({ property, tenant, leaseData }: PDFPreviewProps) {
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
