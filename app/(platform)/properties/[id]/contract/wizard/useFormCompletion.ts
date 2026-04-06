import { useMemo } from "react";
import type { SectionKey } from "./leaseFieldRules";
import { SECTION_VISIBILITY } from "./leaseFieldRules";
import {
  getRequiredFields,
  getRecommendedFields,
  isFieldFilled,
  type RequiredField,
} from "./leaseRequiredFields";
import type { LeaseFormData } from "./types";

export type SectionStatus = {
  filled: number;
  total: number;
  status: "complete" | "incomplete" | "empty";
};

export type MissingField = {
  section: SectionKey;
  field: string;
  label: string;
  blocking: boolean; // true = bloquant, false = recommandé
};

export function useFormCompletion(formData: LeaseFormData, hasGuarantor: boolean) {
  return useMemo(() => {
    const requiredFields = getRequiredFields(formData.leaseType);
    const recommendedFields = getRecommendedFields(formData.leaseType);

    // Filter by visible sections
    const filterVisible = (fields: RequiredField[]) =>
      fields.filter((rf) => {
        const rule = SECTION_VISIBILITY[rf.section];
        return rule ? rule(formData, hasGuarantor) : true;
      });

    const visibleRequired = filterVisible(requiredFields);
    const visibleRecommended = filterVisible(recommendedFields);

    // Compute missing
    const missingRequired: MissingField[] = [];
    const sectionMap = new Map<SectionKey, { filled: number; total: number }>();

    const processFields = (fields: RequiredField[], blocking: boolean) => {
      for (const rf of fields) {
        if (!sectionMap.has(rf.section)) {
          sectionMap.set(rf.section, { filled: 0, total: 0 });
        }
        const sec = sectionMap.get(rf.section)!;
        sec.total++;

        const value = getNestedValue(formData, rf.key);
        if (isFieldFilled(value)) {
          sec.filled++;
        } else {
          missingRequired.push({ section: rf.section, field: rf.key, label: rf.label, blocking });
        }
      }
    };

    processFields(visibleRequired, true);
    processFields(visibleRecommended, false);

    // Section statuses
    const sectionStatus: Partial<Record<SectionKey, SectionStatus>> = {};
    for (const [section, counts] of sectionMap) {
      sectionStatus[section] = {
        ...counts,
        status: counts.filled === counts.total
          ? "complete"
          : counts.filled === 0
            ? "empty"
            : "incomplete",
      };
    }

    // canCompile = only blocking fields matter
    const blockingMissing = missingRequired.filter((m) => m.blocking);
    const totalAll = visibleRequired.length + visibleRecommended.length;
    const filledAll = totalAll - missingRequired.length;

    return {
      sectionStatus,
      missingRequired,
      canCompile: blockingMissing.length === 0,
      overallProgress: {
        filled: filledAll,
        total: totalAll,
        percent: totalAll > 0 ? Math.round((filledAll / totalAll) * 100) : 100,
      },
    };
  }, [formData, hasGuarantor]);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
