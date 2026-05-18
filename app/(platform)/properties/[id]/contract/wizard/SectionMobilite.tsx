"use client";

import type { LeaseFormData } from "./types";

interface Props {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

const SITUATIONS = [
  { key: "stage", label: "Stage", desc: "Stage professionnel ou de formation" },
  { key: "apprentissage", label: "Contrat d’apprentissage", desc: "Contrat d’apprentissage en cours" },
  { key: "formation", label: "Formation professionnelle", desc: "Formation professionnelle continue" },
  { key: "mutation", label: "Mutation professionnelle", desc: "Mutation ou déplacement professionnel" },
  { key: "mission", label: "Mission temporaire", desc: "Mission temporaire dans le cadre professionnel" },
  { key: "service civique", label: "Service civique", desc: "Engagement de service civique" },
  { key: "etude", label: "Études supérieures", desc: "Études supérieures en cours" },
];

export function SectionMobilite({ formData, onFieldChange }: Props) {
  const current = formData.mobilityReason ?? "";

  const isChecked = (key: string) => current.toLowerCase().includes(key.toLowerCase());

  const toggle = (key: string) => {
    const parts = current.split(",").map((s) => s.trim()).filter(Boolean);
    if (isChecked(key)) {
      const filtered = parts.filter((p) => !p.toLowerCase().includes(key.toLowerCase()));
      onFieldChange("mobilityReason", filtered.join(", "));
    } else {
      onFieldChange("mobilityReason", [...parts, key].join(", "));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Sélectionnez le(s) motif(s) justifiant le bail mobilité (article 25-12 de la loi du 6 juillet 1989).
        Au moins un motif est obligatoire.
      </p>

      <div className="grid grid-cols-1 gap-2">
        {SITUATIONS.map((s) => (
          <label
            key={s.key}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              isChecked(s.key)
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked(s.key)}
              onChange={() => toggle(s.key)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">{s.label}</span>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
