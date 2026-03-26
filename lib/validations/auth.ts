import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins 1 majuscule')
    .regex(/\d/, 'Le mot de passe doit contenir au moins 1 chiffre'),
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
