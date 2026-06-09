import { z } from 'zod';

export const UserPatchSchema = z.object({
  plan: z.enum(['FREE', 'PRO']).optional(),
  credits: z.number().int().min(0).max(100000).optional(),
  suspended: z.boolean().optional(),
  suspendedReason: z.string().max(500).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
}).strict();
export type UserPatchInput = z.infer<typeof UserPatchSchema>;

export const UserPromoteSchema = z.object({
  role: z.enum(['owner', 'tenant', 'admin', 'superadmin']),
}).strict();
export type UserPromoteInput = z.infer<typeof UserPromoteSchema>;

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Date ISO invalide' })
  .transform((v) => new Date(v));

export const PropertyPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  addressLine: z.string().max(500).optional(),
  zipCode: z.string().max(20).optional(),
  city: z.string().max(200).optional(),
  rentAmount: z.number().min(0).max(100000).optional(),
  chargesAmount: z.number().min(0).max(100000).optional(),
  surfaceM2: z.number().min(0).max(10000).nullable().optional(),
  propertyType: z.enum(['APPARTEMENT', 'MAISON', 'STUDIO', 'LOFT', 'LOCAL_COMMERCIAL', 'GARAGE', 'AUTRE']).optional(),
  floor: z.number().int().nullable().optional(),
  totalFloors: z.number().int().min(0).nullable().optional(),
  rooms: z.number().int().min(0).nullable().optional(),
  bedrooms: z.number().int().min(0).nullable().optional(),
  equipment: z.array(z.string().max(100)).max(100).optional(),
  description: z.string().max(5000).optional(),
  purchasePrice: z.number().min(0).nullable().optional(),
  purchaseDate: isoDate.nullable().optional(),
  vacantSince: isoDate.nullable().optional(),
  managed: z.boolean().optional(),
  archived: z.boolean().optional(),
  status: z.enum(['AVAILABLE', 'CANDIDATE_SELECTION', 'LEASE_IN_PROGRESS', 'OCCUPIED', 'VACANT']).optional(),
}).strict();

export const LeasePatchSchema = z.object({
  tenantFirstName: z.string().max(100).optional(),
  tenantLastName: z.string().max(100).optional(),
  tenantEmail: z.string().email().max(200).optional(),
  tenantPhone: z.string().max(30).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.nullable().optional(),
  rentAmount: z.number().min(0).max(100000).optional(),
  chargesAmount: z.number().min(0).max(100000).optional(),
  depositAmount: z.number().min(0).max(1000000).optional(),
  propertyType: z.enum(['MEUBLE', 'NU', 'MOBILITE', 'GARAGE_PARKING']).optional(),
  leaseType: z.enum(['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING']).optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  durationMonths: z.number().int().min(1).max(120).optional(),
  additionalClauses: z.string().max(10000).optional(),
  leaseStatus: z.enum(['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED']).optional(),
  irlRevision: z.object({
    enabled: z.boolean().optional(),
    anniversaryDate: isoDate.nullable().optional(),
    referenceIndex: z.number().nullable().optional(),
  }).partial().optional(),
  specificClauses: z.object({
    petsAllowed: z.boolean().optional(),
    terminationClause: z.boolean().optional(),
    recoverableChargesType: z.enum(['PROVISION', 'FORFAIT']).optional(),
  }).partial().optional(),
}).strict();

export const LeaseTerminateSchema = z.object({
  initiatedBy: z.enum(['OWNER', 'TENANT', 'ADMIN']),
  reason: z.string().max(2000).optional(),
  notificationDate: isoDate.optional(),
  estimatedExitDate: isoDate.optional(),
  actualExitDate: isoDate.nullable().optional(),
  depositReturned: z.boolean().optional(),
  depositReturnDate: isoDate.nullable().optional(),
  noticePeriodMonths: z.number().int().min(0).max(12).optional(),
}).strict();

export const PaymentPatchSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PARTIAL', 'LATE', 'UNPAID']).optional(),
  paidAmount: z.number().min(0).optional(),
  note: z.string().max(2000).optional(),
  paymentMethod: z.enum(['VIREMENT', 'CHEQUE', 'ESPECES', 'PRELEVEMENT', 'AUTRE']).optional(),
  // Sécurité (revue V1 — S28) : contraindre le chemin pour empêcher la traversée
  // (le reçu est ensuite path.join(cwd, receiptUrl) puis servi).
  receiptUrl: z
    .string()
    .max(500)
    .regex(/^\/?uploads\/receipts\//, 'Le reçu doit pointer vers uploads/receipts/')
    .refine((v) => !v.includes('..'), 'Chemin de reçu invalide')
    .optional(),
  amounts: z.object({
    rentHC: z.number().min(0).optional(),
    charges: z.number().min(0).optional(),
    totalTTC: z.number().min(0).optional(),
  }).partial().optional(),
  period: z.object({
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2020).max(2100).optional(),
  }).partial().optional(),
  prorata: z.object({
    isProrata: z.boolean().optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    daysInMonth: z.number().int().min(28).max(31).optional(),
    daysOccupied: z.number().int().min(0).optional(),
    ratio: z.number().min(0).max(1).optional(),
  }).partial().optional(),
  revision: z.object({
    applied: z.boolean().optional(),
    previousRent: z.number().min(0).optional(),
    newRent: z.number().min(0).optional(),
    irlIndex: z.number().optional(),
    irlDate: isoDate.optional(),
  }).partial().optional(),
  regularization: z.object({
    applied: z.boolean().optional(),
    realCharges: z.number().min(0).optional(),
    provisionCharges: z.number().min(0).optional(),
    adjustment: z.number().optional(),
  }).partial().optional(),
  discount: z.object({
    applied: z.boolean().optional(),
    amount: z.number().min(0).optional(),
    reason: z.string().max(500).optional(),
  }).partial().optional(),
}).strict();

export const ApplicationPatchSchema = z.object({
  status: z.string().min(1).max(50).optional(),
  note: z.string().max(2000).optional(),
}).strict();

export const ApplicationDocumentPatchSchema = z.object({
  status: z.enum(['PENDING', 'ANALYZING', 'CERTIFIED', 'FLAGGED', 'REJECTED', 'ILLEGIBLE', 'NEEDS_REVIEW']),
  flaggedReason: z.string().max(500).optional(),
}).strict();

export const StripeUpgradeSchema = z.object({
  priceIdRecurring: z.string().max(200).optional(),
  priceIdOneshot: z.string().max(200).optional(),
}).strict();

export const StripeRefundSchema = z.object({
  chargeId: z.string().optional(),
  paymentIntentId: z.string().optional(),
  amount: z.number().min(0).optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
}).strict().refine(
  (d) => d.chargeId || d.paymentIntentId,
  { message: 'chargeId ou paymentIntentId requis' }
);

export const MagicLinkBodySchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(60).optional(),
}).strict();

export const ResetPasswordBodySchema = z.object({
  // Empty body allowed — admin just triggers a reset flow
}).strict().optional();
