/**
 * POST /api/ai/report-summary
 * GLM 5.2 generates a narrative monthly/weekly summary of facility usage.
 * PRD enhancement: Ringkasan Laporan Automatik.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, unauthenticated, forbidden, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { isFacilityAdminOrAbove } from '@/lib/rbac';
import { createZAIClient } from '@/lib/zai-client';

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isFacilityAdminOrAbove(session.role)) return forbidden();
  const ip = getClientIp(req);

  const rl = rateLimit(`ai-report:${session.id}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Aggregate booking data for the last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const bookings = await db.booking.findMany({
    where: { createdAt: { gte: since } },
    include: { facility: { select: { name: true, category: true } } },
  });

  const byStatus = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});
  const byFacility = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.facility.name] = (acc[b.facility.name] ?? 0) + 1;
    return acc;
  }, {});
  const topFacilities = Object.entries(byFacility).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const utilizationRate = bookings.length === 0 ? 0 : Math.round(((byStatus.APPROVED ?? 0) + (byStatus.COMPLETED ?? 0)) / bookings.length * 100);

  const stats = {
    total: bookings.length,
    approved: byStatus.APPROVED ?? 0,
    pending: byStatus.PENDING ?? 0,
    rejected: byStatus.REJECTED ?? 0,
    cancelled: byStatus.CANCELLED ?? 0,
    completed: byStatus.COMPLETED ?? 0,
    utilizationRate,
    topFacilities,
  };

  const systemPrompt = `Anda adalah penjana laporan analitik untuk Sistem e-Tempahan PLTT-JTM.
Berdasarkan statistik 30 hari terakhir, hasilkan ringkasan naratif 4-6 ayat dalam Bahasa Malaysia untuk pengurusan PLTT.
Fokus pada: trend penggunaan, kemudahan paling popular, kadar kelulusan, dan cadangan penambahbaikan.
Statistik: ${JSON.stringify(stats)}
Jawab dengan terus terang, profesional, dan berdasarkan data sahaja.`;

  try {
    const zai = await createZAIClient();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Sila jana ringkasan naratif berdasarkan statistik di atas.' },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });
    const summary = completion.choices[0]?.message?.content ?? '';

    await recordAudit({
      userId: session.id,
      module: 'AI',
      action: 'AI_REPORT_SUMMARY',
      details: { stats },
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ data: { summary, stats } });
  } catch (err) {
    console.error('[AI REPORT ERROR]', err);
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 });
  }
}
