'use client';

import { useState, useCallback, type ChangeEvent, type FormEvent } from 'react';

type ValidationRules<T> = Partial<Record<keyof T, (value: T[keyof T], values: T) => string | null>>;

interface UseFormReturn<T extends Record<string, unknown>> {
  /** Valeurs actuelles du formulaire */
  values: T;
  /** Erreurs de validation par champ */
  errors: Partial<Record<keyof T, string>>;
  /** Le formulaire a été soumis au moins une fois */
  touched: boolean;
  /** Mettre à jour un champ */
  setValue: (name: keyof T, value: T[keyof T]) => void;
  /** Handler pour onChange d'un input */
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  /** Handler pour onSubmit du formulaire */
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e: FormEvent) => void;
  /** Réinitialiser le formulaire */
  reset: () => void;
  /** Valider tous les champs et retourner true si valide */
  validate: () => boolean;
}

/**
 * Hook de gestion de formulaire avec validation.
 *
 * @param initialValues - Valeurs initiales du formulaire
 * @param validationRules - Règles de validation par champ
 * @returns API de gestion du formulaire
 *
 * @example
 * ```tsx
 * const { values, errors, handleChange, handleSubmit } = useForm(
 *   { email: '', password: '' },
 *   { email: (v) => !v ? 'Email requis' : null }
 * );
 * ```
 */
export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  validationRules: ValidationRules<T> = {}
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState(false);

  const runValidation = useCallback(
    (vals: T): Partial<Record<keyof T, string>> => {
      const errs: Partial<Record<keyof T, string>> = {};
      for (const key of Object.keys(validationRules) as Array<keyof T>) {
        const rule = validationRules[key];
        if (rule) {
          const msg = rule(vals[key], vals);
          if (msg) errs[key] = msg;
        }
      }
      return errs;
    },
    [validationRules]
  );

  const setValue = useCallback(
    (name: keyof T, value: T[keyof T]) => {
      setValues(prev => {
        const next = { ...prev, [name]: value };
        if (touched) setErrors(runValidation(next));
        return next;
      });
    },
    [touched, runValidation]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const finalValue = type === 'number' ? Number(value) : value;
      setValue(name as keyof T, finalValue as T[keyof T]);
    },
    [setValue]
  );

  const validate = useCallback((): boolean => {
    const errs = runValidation(values);
    setErrors(errs);
    setTouched(true);
    return Object.keys(errs).length === 0;
  }, [values, runValidation]);

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) =>
      (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        const errs = runValidation(values);
        setErrors(errs);
        if (Object.keys(errs).length === 0) {
          onSubmit(values);
        }
      },
    [values, runValidation]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched(false);
  }, [initialValues]);

  return { values, errors, touched, setValue, handleChange, handleSubmit, reset, validate };
}
