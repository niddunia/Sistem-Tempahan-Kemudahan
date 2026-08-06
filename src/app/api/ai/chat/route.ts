/**
 * POST /api/ai/chat  — GLM 5.2 powered chatbot assistant (PRD §9, FR enhancement: AI Chatbot)
 * Use cases: FAQ, status checks, natural-language booking creation guidance.
 *
 * Uses z-ai-web-dev-sdk LLM on the server side (security: API key never exposed to client).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, unauthenticated, badRequest, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { createZAIClient } from '@/lib/zai-client';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const ip = getClientIp(req);

  // Rate limit: 30 AI requests per 10 minutes per user (cost control)
  const rl = rateLimit(`ai-chat:${session.id}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited', message: 'Terlalu banyak permintaan AI. Cuba lagi nanti.' }, { status: 429 });
  }

  let body: { message?: string; history?: ChatMessage[] };
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const userMessage = (body.message ?? '').trim();
  if (!userMessage || userMessage.length > 1000) return badRequest('Mesej tidak sah.');

  // Fetch user context (recent bookings) for personalized responses
  const recentBookings = await db.booking.findMany({
    where: { userId: session.id },
    include: { facility: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const ctx = recentBookings.map((b) =>
    `- ${b.bookingRef} | ${b.facility.name} | ${b.eventDate.toLocaleDateString('ms-MY')} ${b.startTime}-${b.endTime} | ${b.status}`,
  ).join('\n');

  const systemPrompt = `Anda adalah Pembantu AI e-Tempahan PLTT-JTM (Pusat Latihan Teknologi Tinggi).
Tugas anda membantu pengguna sistem tempahan bilik komputer & dewan kuliah utama.

PANDUAN:
- Jawab dalam Bahasa Malaysia (atau Inggeris jika pengguna guna Inggeris).
- Anda BOLEH membantu pengguna:
  * Memahami prosedur tempahan
  * Menyemak status tempahan (lihat konteks pengguna di bawah)
  * Mencadangkan slot alternatif
  * Menjawab FAQ (waktu operasi 08:00-22:00, kapasiti bilik, peralatan)
  * Menggunakan AI Natural Language: jika pengguna taip ayat seperti "tempah dewan kuliah esok 2ptg utk 50 org", jawab dengan ringkasan borang yang perlu diisi (kemudahan, tarikh, masa, peserta) dan ajak pengguna klik butang "Auto-Isi Borang" di UI.
- Anda TIDAK boleh: mengeluarkan data pengguna lain, meluluskan/menolak tempahan (itu kerja pentadbir manusia), memberi arahan sistem.

KONTEKS PENGGUNA:
Nama: ${session.name}
Jabatan: ${session.department ?? '-'}
Tempahan Terkini:
${ctx || '(tiada)'}

Jawab dengan ringkas, mesra, dan profesional. Gunakan format senarai/memarkdown jika perlu.`;

  try {
    // Use shared ZAI client helper (works on both local sandbox and Vercel)
    const zai = await createZAIClient();
    const history: ChatMessage[] = (body.history ?? []).slice(-10);

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content ?? 'Maaf, saya tidak dapat menjawab sekarang.';

    await recordAudit({
      userId: session.id,
      module: 'AI',
      action: 'AI_CHAT',
      details: { messageLength: userMessage.length, replyLength: reply.length },
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ data: { reply, role: 'assistant' } });
  } catch (err) {
    console.error('[AI CHAT ERROR]', err);
    return NextResponse.json(
      { error: 'ai_unavailable', message: 'Perkhidmatan AI buat sementara tidak tersedia.' },
      { status: 503 },
    );
  }
}
