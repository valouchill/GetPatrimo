"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Settings,
  Wifi,
  Droplets,
  Home,
  Sparkles,
  FileText,
} from "lucide-react";
import { getAllClauses } from "./clauses";
import { Clause } from "./types";
import { SmartCard } from "./SmartCard";

/**
 * Composant Clause Toggle - Carte interactive pour chaque clause
 */
export interface ClauseToggleProps {
  clause: Clause;
  isSelected: boolean;
  onToggle: () => void;
}

export function ClauseToggle({ clause, isSelected, onToggle }: ClauseToggleProps) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isSelected}
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

/**
 * Composant Section Clauses Optionnelles
 */
export interface OptionalClausesSectionProps {
  selectedClauses: string[];
  customClause: string;
  onClauseToggle: (clauseId: string) => void;
  onCustomClauseChange: (text: string) => void;
}

export function OptionalClausesSection({
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
            aria-label="Clause personnalisée libre"
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
