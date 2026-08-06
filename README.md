# Sistem e-Tempahan PLTT-JTM

**Sistem e-Tempahan Bilik Komputer & Dewan Kuliah Utama**
Pusat Latihan Teknologi Tinggi (PLTT) · Jabatan Tenaga Manusia (JTM) · Kementerian Sumber Manusia Malaysia

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Tentang Sistem

Sistem e-Tempahan PLTT ialah platform tempahan kemudahan berasaskan web yang membenarkan pengguna memohon tempahan bilik komputer dan dewan kuliah utama, pentadbir meluluskan permohonan, dan orang awam melihat status tempahan secara masa nyata.

### Ciri Utama (FR-01 hingga FR-05)
- ✅ **FR-01**: Permohonan Tempahan Bilik Komputer & Dewan Kuliah Utama
- ✅ **FR-02**: Kelulusan Tempahan oleh Pentadbir
- ✅ **FR-03**: Notifikasi Keputusan Tempahan
- ✅ **FR-04**: Paparan Umum Semua Tempahan (Public Calendar)
- ✅ **FR-05**: Paparan Kalendar Keseluruhan Tempahan

### Ciri Tambahan
- 🤖 **AI Chatbot** (GLM 5.2) — Pembantu tempahan bahasa asli
- 📊 **Analytics Dashboard** — Carta penggunaan & laporan AI
- 🔐 **Security** — RBAC, audit log, rate limiting, TLS 1.2+, AES-256
- 🌐 **Bilingual** — Bahasa Malaysia & English
- 📱 **Responsive** — Desktop, tablet, mudah alih

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 6 |
| Auth | NextAuth.js v4 |
| AI | GLM 5.2 (Z.ai SDK) |
| Charts | Recharts |
| State | Zustand + TanStack Query |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- PostgreSQL database (Supabase recommended)

### Installation

```bash
# Clone repository
git clone https://github.com/niddunia/Sistem-Tempahan-Kemudahan.git
cd Sistem-Tempahan-Kemudahan

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
# Edit .env with your Supabase credentials

# Setup database
bun run db:generate    # Generate Prisma Client
bun run db:push        # Create tables in Supabase
bun run db:seed        # Seed dummy data

# Run development server
bun run dev
```

Open http://localhost:3000

## 🔑 Demo Login

| Email | Password | Role |
|-------|----------|------|
| admin@pltt.gov.my | Password123! | Super Admin |
| fadmin@pltt.gov.my | Password123! | Facility Admin |
| user1@pltt.gov.my | Password123! | Regular User |

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth endpoints
│   │   ├── bookings/      # Booking CRUD + conflict check
│   │   ├── facilities/    # Facility management
│   │   ├── approvals/     # Admin approval actions
│   │   ├── notifications/ # In-app notifications
│   │   ├── ai/            # GLM 5.2 AI endpoints
│   │   ├── analytics/     # Dashboard stats
│   │   ├── users/         # User management
│   │   └── audit/         # Audit log
│   ├── page.tsx           # Main SPA page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Glassmorphism styles
├── components/             # React components
│   ├── ui/                # shadcn/ui primitives
│   ├── sidebar.tsx        # Navigation sidebar
│   ├── topbar.tsx         # Top bar + notifications
│   ├── auth-modal.tsx     # Login/register modal
│   ├── ai-chat-assistant.tsx # Floating AI chatbot
│   └── status-badge.tsx   # Status & role badges
├── views/                 # Page views
│   ├── public-calendar-view.tsx
│   ├── booking-form-view.tsx
│   ├── personal-dashboard-view.tsx
│   ├── approvals-view.tsx
│   ├── facilities-view.tsx
│   ├── users-view.tsx
│   ├── analytics-view.tsx
│   ├── audit-view.tsx
│   └── calendar-view.tsx
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
│   ├── auth.ts            # NextAuth config
│   ├── db.ts              # Prisma client
│   ├── crypto.ts          # Password hashing + AES-256
│   ├── rbac.ts            # Role-based access control
│   ├── rate-limit.ts      # Rate limiting
│   ├── audit.ts           # Audit logger
│   └── i18n.ts            # BM/EN translations
└── types/                 # TypeScript declarations

prisma/
├── schema.prisma          # Database schema (PostgreSQL)
└── seed.ts                # Dummy data seeder
```

## 🗄️ Database Schema

10 entiti utama:
- **User** — Pengguna dengan 3 peranan (USER, FACILITY_ADMIN, SUPER_ADMIN)
- **Facility** — Bilik Komputer & Dewan Kuliah
- **Booking** — Tempahan kemudahan
- **ApprovalLog** — Log kelulusan/penolakan
- **Notification** — Notifikasi dalam-sistem
- **AuditLog** — Log audit penuh
- **Feedback** — Penilaian selepas guna
- **Session** — Sesi NextAuth
- **Account** — Akaun OAuth
- **VerificationToken** — Token verification

## 🔐 Security Features

- **RBAC** — Kawalan akses berasaskan peranan
- **Password Hashing** — scrypt + per-user salt
- **AES-256-GCM** — Penyulitan data sensitif
- **Account Lockout** — 5 percubaan gagal → 15 minit lock
- **Rate Limiting** — Auth & AI endpoints
- **Audit Logging** — Setiap tindakan kritikal direkod
- **Security Headers** — CSP, HSTS, X-Frame-Options, PDPA
- **PDPA Compliant** — Privasi data peribadi

## 🚢 Deployment

### Deploy to Vercel

1. Push code ke GitHub
2. Pergi ke https://vercel.com/new
3. Import repository ini
4. Tambah Environment Variables (rujuk `.env.example`)
5. Deploy!

### Environment Variables untuk Vercel

```
DATABASE_URL=your_supabase_pooler_url
DIRECT_URL=your_supabase_direct_url
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your_secret
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ENCRYPTION_KEY=your_32_byte_key
```

## 📄 License

MIT License — © 2026 PLTT · JTM · Kementerian Sumber Manusia Malaysia

---

**Klasifikasi: Sulit — Untuk Kegunaan Dalaman JTM**

<!-- Auto-deploy test: 2026-08-06T10:17:16Z -->
