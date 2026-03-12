"use client";

import PatrimoTrustGauge from "./PatrimoTrustGauge";

/**
 * Exemple d'utilisation du composant PatrimoTrustGauge
 */
export default function PatrimoTrustGaugeExample() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center gap-12">
      <h1 className="text-3xl font-serif font-bold text-navy mb-8">
        Exemples PatrimoTrustGauge
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Score faible (< 60) */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold text-navy">Score Faible</h2>
          <PatrimoTrustGauge score={45} />
        </div>
        
        {/* Score moyen (60-79) */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold text-navy">Score Moyen</h2>
          <PatrimoTrustGauge score={72} />
        </div>
        
        {/* Score élevé (>= 80) */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold text-navy">Score Élevé</h2>
          <PatrimoTrustGauge score={92} />
        </div>
      </div>
      
      {/* État de chargement */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <h2 className="text-lg font-semibold text-navy">État de Chargement</h2>
        <PatrimoTrustGauge score={85} isLoading={true} />
      </div>
    </div>
  );
}
