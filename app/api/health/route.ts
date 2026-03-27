import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const status = mongoStatus === 'connected' ? 'healthy' : 'degraded';
  const code = status === 'healthy' ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      mongo: mongoStatus,
    },
    { status: code }
  );
}
