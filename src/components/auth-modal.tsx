'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, Building2, Phone, BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from '@/components/logo';
import { useApp } from '@/lib/store';
import { useT } from '@/hooks/use-t';
import { toast } from 'sonner';

export function AuthModal() {
  const open = useApp((s) => s.authOpen);
  const setOpen = useApp((s) => s.setAuthOpen);
  const { t, lang } = useT();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-md glass-strong rounded-2xl p-6 shadow-2xl"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-foreground/10 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center mb-5">
              <Logo showText={false} className="mb-2" />
              <h2 className="text-lg font-bold gradient-text">{t('login_welcome')}</h2>
              <p className="text-xs text-muted-foreground text-center mt-1">{t('login_subtitle')}</p>
            </div>

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 glass-input">
                <TabsTrigger value="signin" className="text-xs">{t('sign_in')}</TabsTrigger>
                <TabsTrigger value="signup" className="text-xs">{t('sign_up')}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <SignInForm onClose={() => setOpen(false)} />
              </TabsContent>
              <TabsContent value="signup">
                <SignUpForm onClose={() => setOpen(false)} />
              </TabsContent>
            </Tabs>

            <div className="mt-5 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>{lang === 'bm' ? 'Sambungan disulitkan TLS 1.2+ · PDPA-compliant' : 'Encrypted TLS 1.2+ · PDPA-compliant'}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SignInForm({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error(t('login_failed'));
      return;
    }
    toast.success(lang === 'bm' ? 'Log masuk berjaya!' : 'Signed in successfully!');
    onClose();
    // refresh to load session
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@pltt.gov.my"
            className="pl-9 glass-input"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('password')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-9 glass-input"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full gradient-primary text-white border-0">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('sign_in')}
      </Button>
      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2.5 leading-relaxed">
        <span className="font-semibold">Demo login:</span><br />
        admin@pltt.gov.my · fadmin@pltt.gov.my · user1@pltt.gov.my<br />
        Kata laluan: <code className="font-mono">Password123!</code>
      </div>
    </form>
  );
}

function SignUpForm({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [form, setForm] = useState({
    name: '', email: '', password: '', department: '', phone: '', staffId: '',
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? 'Register failed');
      toast.success('Pendaftaran berjaya! Sila log masuk.');
      // auto sign-in
      await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      onClose();
      setTimeout(() => window.location.reload(), 300);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Pendaftaran gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5 max-h-[55vh] overflow-y-auto scroll-area-thin pr-1">
      <Field icon={<UserIcon className="w-4 h-4" />} label={t('name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
      <Field icon={<Mail className="w-4 h-4" />} label={t('email')} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
      <Field icon={<Lock className="w-4 h-4" />} label={t('password')} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
      <Field icon={<Building2 className="w-4 h-4" />} label={t('department')} value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
      <Field icon={<Phone className="w-4 h-4" />} label={t('phone')} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      <Field icon={<BadgeCheck className="w-4 h-4" />} label={t('staffId')} value={form.staffId} onChange={(v) => setForm({ ...form, staffId: v })} />
      <Button type="submit" disabled={loading} className="w-full gradient-primary text-white border-0 mt-3">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('sign_up')}
      </Button>
    </form>
  );
}

function Field({
  icon, label, value, onChange, type = 'text', required,
}: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}{required && <span className="text-rose-500">*</span>}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="pl-9 glass-input text-sm"
        />
      </div>
    </div>
  );
}
