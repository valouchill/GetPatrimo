"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

/**
 * Smart Card - Carte interactive pour la configuration
 */
export interface SmartCardProps {
  icon: React.ReactNode;
  title: string;
  isComplete: boolean;
  children: React.ReactNode;
}

export function SmartCard({ icon, title, isComplete, children }: SmartCardProps) {
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
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-navy">{value}</span>
    </div>
  );
}
