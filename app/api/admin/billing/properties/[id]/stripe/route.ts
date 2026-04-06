import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, AdminHttpError } from '@/lib/auth-admin';
import { getStripeClient } from '@/lib/admin-stripe';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const property = await Property.findById(id).lean();
  if (!property) throw new AdminHttpError(404, 'Propriété introuvable');

  const stripe = getStripeClient();

  const result: any = {
    propertyId: id,
    managed: Boolean((property as any).managed),
    customer: null,
    subscription: null,
    invoices: [],
  };

  // Try property.stripeCustomerId first, then owner user
  let customerId: string = (property as any).stripeCustomerId || '';
  if (!customerId && (property as any).user) {
    const owner = await User.findById((property as any).user).select('stripeCustomerId').lean();
    customerId = (owner as any)?.stripeCustomerId || '';
  }

  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!(customer as any).deleted) {
        result.customer = {
          id: customer.id,
          email: (customer as any).email,
          name: (customer as any).name,
        };
      }
    } catch (err: any) {
      result.customerError = err.message;
    }
  }

  const subId = (property as any).stripeSubscriptionId;
  if (subId) {
    try {
      const sub: any = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] });
      result.subscription = {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        items: sub.items.data.map((it: any) => ({
          priceId: it.price.id,
          amount: it.price.unit_amount,
          currency: it.price.currency,
          interval: it.price.recurring?.interval,
        })),
      };
    } catch (err: any) {
      result.subscriptionError = err.message;
    }
  }

  if (customerId) {
    try {
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
      result.invoices = invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount_due: inv.amount_due,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        created: inv.created,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
      }));
    } catch (err: any) {
      result.invoicesError = err.message;
    }
  }

  return NextResponse.json(result);
});
