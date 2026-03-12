import { NextRequest, NextResponse } from "next/server";
import type { PropertyData } from "@/lib/owner-tunnel/property-data-schema";

const SYSTEM_PROMPT = `# RÔLE ET PERSONA
Tu es l'Expert PatrimoTrust, un concierge immobilier de très haut niveau. Ton rôle est d'accompagner un propriétaire exigeant dans la valorisation de son actif immobilier.
Tu as la posture d'un agent immobilier de prestige : tu es courtois, naturellement curieux, subtil et fluide dans ta conversation. Tu cherches à découvrir "l'âme" du bien.

# RÈGLE D'OR — AUTO-CORRECTION
Si l'utilisateur contredit une information précédente (ex: correction de surface ou d'adresse), mets à jour ta base de données silencieusement et adapte ton discours sans signaler d'erreur système. Ne dis jamais "Vous aviez dit..." ou "Correction enregistrée". Intègre naturellement.

# TON ET STYLE
- Chaleureux, élégant, et valorisant. Utilise le vouvoiement.
- Fais preuve de curiosité professionnelle : intéresse-toi aux détails qui font la différence (la lumière, les matériaux, le quartier).
- La conversation doit être fluide, comme un échange autour d'un café dans un beau bureau.
- Ne sois pas robotique. Rebondis sur les réponses du propriétaire avec un commentaire pertinent avant de poser ta question suivante.

# STRATÉGIE DE COLLECTE (INCITATION DOUCE)
Ton but est de remplir un objet JSON PropertyData (address, surface_m2, furnished, etiquette_dpe, photos_count) de manière organique :
1. **Pour les photos :** Incite fortement au dépôt visuel en expliquant la valeur ajoutée.
2. **Pour le DPE :** Présente-le comme un soulagement administratif.

# RÈGLES DE COMPORTEMENT
1. **UNE SEULE QUESTION À LA FOIS :** Garde un rythme naturel.
2. **ABSORPTION SILENCIEUSE :** Si le propriétaire donne plusieurs infos, valide-les élégamment et passe à la suite.
3. **LA CONCLUSION :** Quand PropertyData est complet (address, surface_m2, furnished, etiquette_dpe remplis), conclus avec enthousiasme puis retourne isComplete: true.

# FORMAT DE RÉPONSE (STRICT)
Tu dois répondre en DEUX parties séparées par exactement __JSON__ (sur sa propre ligne) :

**Partie 1 (streamée à l'utilisateur)** : Ta question ou ton message élégant.
- Si ta question est binaire (ex: vide/meublé, oui/non), commence par : __QUICK__["Option1","Option2"]__END__ suivi d'un saut de ligne, puis ta question.
- Exemple : __QUICK__["Vide","Meublé"]__END__\n\nVotre bien est-il vide ou meublé ?

**Partie 2 (après __JSON__)** : JSON uniquement avec cette structure :
{"propertyData": {"address":string|null,"surface_m2":number|null,"rooms":number|null,"furnished":"vide"|"meuble"|null,"etiquette_dpe":"A"|"B"|"C"|"D"|"E"|"F"|"G"|null,"has_dpe_document":boolean,"photos_count":number},"isComplete":boolean}

Extrais les infos de la réponse pour mettre à jour propertyData.`;

function parseJsonBlock(text: string): Record<string, unknown> | null {
  try {
    const idx = text.indexOf("__JSON__");
    if (idx === -1) return null;
    const jsonPart = text.slice(idx + 8).replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonPart) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractQuickReplies(text: string): string[] | null {
  const m = text.match(/__QUICK__\s*(\[[\s\S]*?\])\s*__END__/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as string[];
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const propertyData = (body.propertyData ?? {}) as PropertyData;
    const userMessage = String(body.userMessage ?? "").trim();
    const history = (body.messages ?? []) as { role: "user" | "agent"; text: string }[];
    const stream = body.stream === true;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY manquante" }, { status: 500 });
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: (m.role === "agent" ? "assistant" : "user") as "user" | "assistant",
        content: m.text,
      })),
      {
        role: "user",
        content: `PropertyData actuel : ${JSON.stringify(propertyData)}\nDernière réponse du propriétaire : "${userMessage}"\n\nMet à jour PropertyData et génère la question suivante. Réponds selon le format (Partie 1 puis __JSON__ puis Partie 2).`,
      },
    ];

    if (!stream) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 600,
          temperature: 0.3,
          messages,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: "OpenAI " + res.status + " " + err }, { status: 502 });
      }
      const data = await res.json();
      const raw = (data.choices?.[0]?.message?.content ?? "").trim();
      const quickReplies = extractQuickReplies(raw);
      const parsed = parseJsonBlock(raw);
      const pd = (parsed?.propertyData ?? propertyData) as PropertyData;
      const isComplete = Boolean(parsed?.isComplete);
      let nextQuestion = raw.split("__JSON__")[0]?.replace(/__QUICK__\s*\[[\s\S]*?\]\s*__END__\s*/g, "").trim() ?? "Quelle est l'adresse de votre bien ?";
      return NextResponse.json({
        propertyData: pd,
        nextQuestion,
        isComplete,
        quick_replies: quickReplies ?? undefined,
      });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 600,
        temperature: 0.3,
        stream: true,
        messages,
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      return NextResponse.json({ error: "OpenAI " + res.status + " " + err }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const stream2 = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let rawBuffer = "";
        let contentBuffer = "";
        let lastSentLen = 0;
        let quickRepliesSent = false;

        const sendToken = (chunk: string) => {
          if (chunk) controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            rawBuffer += decoder.decode(value, { stream: true });
            const lines = rawBuffer.split("\n");
            rawBuffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (!delta) continue;
                contentBuffer += delta;

                if (!quickRepliesSent) {
                  const qr = extractQuickReplies(contentBuffer);
                  if (qr?.length) {
                    quickRepliesSent = true;
                    controller.enqueue(encoder.encode(`event: quick_replies\ndata: ${JSON.stringify(qr)}\n\n`));
                  }
                }

                const beforeJson = contentBuffer.split("__JSON__")[0];
                const display = beforeJson.replace(/__QUICK__\s*\[[\s\S]*?\]\s*__END__\s*/g, "").trim();
                if (display.length > lastSentLen) {
                  sendToken(display.slice(lastSentLen));
                  lastSentLen = display.length;
                }
              } catch {
                /* skip */
              }
            }
          }

          const parsed = parseJsonBlock(contentBuffer);
          if (parsed) {
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(parsed)}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Réponse invalide" })}\n\n`));
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream2, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("owner-tunnel agent:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur agent" },
      { status: 500 }
    );
  }
}
