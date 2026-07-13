'use client';

import { useApp } from '@/lib/store';
import { translations, type TranslationKey } from '@/lib/i18n';

export function useT() {
  const lang = useApp((s) => s.lang);
  return {
    lang,
    t: (key: TranslationKey) => translations[lang][key] ?? translations.bm[key] ?? key,
  };
}
