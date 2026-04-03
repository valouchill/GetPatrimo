/**
 * Audit trail service — logs sensitive user actions to the Event collection.
 *
 * Usage:
 *   import { auditLog } from '@/lib/services/audit';
 *   await auditLog({ userId, action: 'LEASE_SIGNED', propertyId, meta: { leaseId } });
 */

import { logger } from '@/lib/server-logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Event = require('@/models/Event');

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'TOTP_ENABLED'
  | 'TOTP_DISABLED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'LEASE_CREATED'
  | 'LEASE_SIGNED'
  | 'LEASE_TERMINATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIPT_SENT'
  | 'PROPERTY_CREATED'
  | 'PROPERTY_DELETED'
  | 'TENANT_SELECTED'
  | 'TENANT_REJECTED'
  | 'DATA_EXPORTED'
  | 'ACCOUNT_DELETED'
  | 'STRIPE_CHECKOUT'
  | 'DIDIT_VERIFIED';

interface AuditEntry {
  userId?: string;
  action: AuditAction;
  propertyId?: string;
  tenantId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await Event.create({
      user: entry.userId || null,
      property: entry.propertyId || null,
      tenant: entry.tenantId || null,
      type: `AUDIT_${entry.action}`,
      meta: {
        ...entry.meta,
        ...(entry.ip && { ip: entry.ip }),
      },
    });
  } catch (err) {
    // Never throw from audit — log and continue
    logger.error('[audit] Failed to write audit log', {
      action: entry.action,
      error: err instanceof Error ? err.message : err,
    });
  }
}
