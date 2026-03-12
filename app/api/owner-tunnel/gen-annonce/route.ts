import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
  const payload = await req.json();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.5,
      messages: [
        { role: 'system', content: 'Redacteur annonces immobilières.' },
        { role: 'user', content: 'Redige une annonce avec: ' + JSON.stringify(payload) },
      ],
    }),
  });
  if (!res.ok) return NextResponse.json({ error: 'OpenAI' }, { status: 502 });
  const data = await res.json();
  const annonce = (data.choices?.[0]?.message?.content?.trim() as string) || '';
  return NextResponse.json({ success: true, annonce });
}
