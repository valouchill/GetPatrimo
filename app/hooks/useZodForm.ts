'use client';

import { useForm, type UseFormReturn, type DefaultValues, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Hook combinant react-hook-form avec zodResolver pour la validation de formulaire.
 *
 * @param schema - Schéma Zod pour la validation
 * @param defaultValues - Valeurs initiales du formulaire
 * @returns Instance react-hook-form avec validation Zod
 *
 * @example
 * ```tsx
 * const form = useZodForm(ApplySchema, { firstName: '', lastName: '' });
 * <input {...form.register('firstName')} />
 * {form.formState.errors.firstName?.message}
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useZodForm<T extends FieldValues>(
  schema: any,
  defaultValues?: DefaultValues<T>
): UseFormReturn<T> {
  return useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });
}

/**
 * Retourne le message d'erreur d'un champ, ou undefined.
 */
export function fieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>
): string | undefined {
  return form.formState.errors[name]?.message as string | undefined;
}
