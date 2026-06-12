import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';

  const checks = {
    mongo: mongoStatus === 'connected',
    openai: !!process.env.OPENAI_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    email: !!(process.env.BREVO_USER && process.env.BREVO_PASS),
    sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  };

  const allHealthy = checks.mongo; // Only mongo is critical
  const status = allHealthy ? 'healthy' : 'degraded';
  const code = allHealthy ? 200 : 503;

  // Sécurité (pentest ChatGPT P2/P3) : payload public minimal — pas de version/node/mémoire
  // ni d'inventaire des services configurés (réduisait la surface de reconnaissance).
  return NextResponse.json(
    { status, mongo: mongoStatus },
    { status: code, headers: { 'Cache-Control': 'no-store' } }
  );
}
