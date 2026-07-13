'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User as UserIcon, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/lib/store';
import { useT } from '@/hooks/use-t';
import { useCurrentUser } from '@/hooks/use-current-user';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Bagaimana cara mohon tempahan?',
  'Apakah waktu operasi bilik?',
  'Berapa kapasiti Dewan Kuliah Utama?',
  'Tempah dewan kuliah esok 2ptg utk 50 org',
];

export function AIChatAssistant() {
  const { user } = useCurrentUser();
  const { t, lang } = useT();
  const setView = useApp((s) => s.setView);
  const setBookingPrefill = useApp((s) => s.setBookingPrefill);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!user) {
      toast.error(lang === 'bm' ? 'Sila log masuk untuk menggunakan Pembantu AI.' : 'Please sign in to use AI Assistant.');
      useApp.getState().setAuthOpen(true);
      return;
    }
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages.slice(-6) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? 'AI error');
      setMessages([...next, { role: 'assistant', content: j.data.reply }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: lang === 'bm' ? 'Maaf, terdapat ralat. Sila cuba lagi.' : 'Sorry, an error occurred. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const tryAutoFill = async () => {
    if (!input.trim()) return;
    toast.loading(lang === 'bm' ? 'Menerjemah permintaan...' : 'Parsing your request...', { id: 'parse' });
    try {
      const res = await fetch('/api/ai/parse-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const j = await res.json();
      toast.dismiss('parse');
      if (!res.ok) throw new Error();
      setBookingPrefill(j.data);
      setView('book');
      setOpen(false);
      toast.success(lang === 'bm' ? 'Borang diisi automatik!' : 'Form auto-filled!');
    } catch {
      toast.dismiss('parse');
      toast.error(lang === 'bm' ? 'Gagal memproses. Cuba lagi.' : 'Failed to parse. Try again.');
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-primary shadow-xl shadow-teal-500/40 flex items-center justify-center text-white hover:scale-105 transition-transform animate-pulse-glow"
        whileTap={{ scale: 0.92 }}
        aria-label={t('ai_assistant')}
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[min(92vw,400px)] h-[min(70vh,560px)] glass-strong rounded-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 gradient-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">{t('ai_assistant')}</div>
                  <div className="text-[10px] opacity-90">{t('powered_by_ai')}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3 scroll-area-thin" ref={scrollRef as never}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                  <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{lang === 'bm' ? 'Selamat Datang!' : 'Welcome!'}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {lang === 'bm' ? 'Tanya saya apa-apa tentang sistem tempahan.' : 'Ask me anything about the booking system.'}
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-xs text-left px-3 py-2 rounded-lg glass-input hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition border border-border/50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-teal-500' : 'gradient-accent'}`}>
                        {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-teal-500 text-white rounded-tr-sm' : 'glass-input rounded-tl-sm'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full gradient-accent flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="glass-input px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
                        <span className="text-xs">{t('loading')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border/40 glass-nav">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('ai_placeholder')}
                className="min-h-[44px] max-h-[100px] resize-none glass-input text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs flex-1 glass-input border-border/50"
                  onClick={tryAutoFill}
                  disabled={!input.trim() || loading}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {lang === 'bm' ? 'Auto-Isi Borang' : 'Auto-Fill Form'}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs gradient-primary text-white border-0"
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                >
                  <Send className="w-3.5 h-3.5" />
                  {t('send')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
