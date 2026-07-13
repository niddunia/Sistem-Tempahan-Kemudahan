/**
 * POST /api/ai/parse-booking
 * GLM 5.2 parses a natural-language request into a structured booking draft.
 * PRD enhancement: Pembantu Tempahan Bahasa Asli.
 *
 * Returns: { facility, date, startTime, endTime, participants, purpose }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, unauthenticated, badRequest, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';

interface ParsedBooking {
  facility?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  participants?: number;
  purpose?: string;
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const ip = getClientIp(req);

  const rl = rateLimit(`ai-parse:${session.id}`, 20, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', message: 'Terlalu banyak permintaan AI.' }, { status: 429 });
  }

  let body: { message?: string };
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const msg = (body.message ?? '').trim();
  if (!msg || msg.length > 500) return badRequest('Mesej tidak sah.');

  // List available facilities for the model to pick from
  const facilities = await db.facility.findMany({
    where: { status: 'ACTIVE' },
    select: { name: true, category: true, capacity: true },
  });
  const facList = facilities.map((f) => `${f.name} (${f.category}, capacity ${f.capacity})`).join(', ');

  const systemPrompt = `Anda adalah parser Natural-Language untuk sistem e-Tempahan PLTT.
Tukar ayat pengguna kepada JSON struktur dengan medan berikut:
- facility (nama kemudahan yang paling hampir, pilih dari senarai)
- date (YYYY-MM-DD; "esok" = hari ini +1, "hari ini" = hari ini, "lusa" = +2; HARI INI: ${new Date().toISOString().slice(0, 10)})
- startTime (HH:mm format 24 jam; "2 ptg" = "14:00", "9 pagi" = "09:00")
- endTime (HH:mm; jika tidak dinyatakan, anggap 2 jam selepas mula)
- participants (nombor; "50 org" = 50)
- purpose (ringkasan tujuan dalam 5-10 patah)

Senarai kemudahan tersedia: ${facList}

Jawab HANYA dengan JSON yang sah, tiada penjelasan tambahan. Jika maklumat tidak lengkap, isikan medan kosong dengan null.`;

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: msg },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: ParsedBooking = JSON.parse(cleaned);

    // Try to match facility name to actual facility id
    let facilityId: string | null = null;
    if (parsed.facility) {
      const match = await db.facility.findFirst({
        where: { name: { contains: parsed.facility } },
      });
      facilityId = match?.id ?? null;
    }

    await recordAudit({
      userId: session.id,
      module: 'AI',
      action: 'AI_PARSE_BOOKING',
      details: { message: msg, parsed },
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ data: { ...parsed, facilityId } });
  } catch (err) {
    console.error('[AI PARSE ERROR]', err);
    return NextResponse.json({ error: 'ai_unavailable', message: 'Gagal memproses permintaan.' }, { status: 503 });
  }
}
