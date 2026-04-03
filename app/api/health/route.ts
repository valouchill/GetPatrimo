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

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      services: {
        mongo: mongoStatus,
        openai: checks.openai ? 'configured' : 'missing',
        stripe: checks.stripe ? 'configured' : 'missing',
        email: checks.email ? 'configured' : 'missing',
        sentry: checks.sentry ? 'configured' : 'not configured',
      },
    },
    { status: code, headers: { 'Cache-Control': 'no-store' } }
  );
}
