import { useMemo } from "react";
import { SECTION_VISIBILITY, FIELD_VISIBILITY, type SectionKey } from "./leaseFieldRules";
import type { LeaseFormData } from "./types";

export function useFieldVisibility(formData: LeaseFormData, hasGuarantor: boolean) {
  return useMemo(() => {
    const isSectionVisible = (section: SectionKey): boolean => {
      const rule = SECTION_VISIBILITY[section];
      return rule ? rule(formData, hasGuarantor) : true;
    };

    const isFieldVisible = (field: string): boolean => {
      const rule = FIELD_VISIBILITY[field];
      return rule ? rule(formData, hasGuarantor) : true;
    };

    return { isSectionVisible, isFieldVisible };
  }, [formData, hasGuarantor]);
}
