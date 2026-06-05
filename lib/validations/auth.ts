import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins 1 minuscule')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins 1 majuscule')
    .regex(/\d/, 'Le mot de passe doit contenir au moins 1 chiffre')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Le mot de passe doit contenir au moins 1 caractère spécial'),
  role: z.enum(['owner', 'tenant']).default('owner'),
  // Optionnel : un locataire sans code crée un Passeport Locatif universel (codeless).
  propertyCode: z.string().regex(/^PT-\d{5}-[A-Z0-9]{4}$/, 'Format de code invalide (ex: PT-75001-K7M9)').optional(),
});

export const LoginPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const SendOtpSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email('Email invalide'),
  otp: z.string().length(6, 'Le code doit contenir 6 chiffres'),
  propertyData: z.object({
    address: z.string().optional(),
    rentAmount: z.number().optional(),
    surfaceM2: z.number().optional(),
  }).optional(),
  passportSlug: z.string().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Lien de réinitialisation manquant'),
  password: z.string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins 1 minuscule')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins 1 majuscule')
    .regex(/\d/, 'Le mot de passe doit contenir au moins 1 chiffre')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Le mot de passe doit contenir au moins 1 caractère spécial'),
});
