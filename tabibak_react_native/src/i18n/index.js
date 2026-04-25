/**
 * i18n Engine — Tabibok Health
 *
 * Stack: expo-localization (device language detection) + i18next + react-i18next
 *
 * RTL Strategy:
 *   • I18nManager.allowRTL(true) is called in index.js (before app mount)
 *   • When the device language is Arabic, React Native's layout engine
 *     automatically mirrors start/end → right/left at the native layer.
 *   • We never call forceRTL() at runtime — that requires an app restart and
 *     is reserved for an explicit in-app language toggle (Phase 5 feature).
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t, i18n } = useTranslation();
 *   t('common.save')                // → 'Save' / 'حفظ'
 *   t('doctors.experienceYears', { n: 10 }) // → '10 years' / '10 سنوات'
 *   i18n.language                   // → 'en' | 'ar'
 *   i18n.isRTL                      // → false | true
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from '../locales/en';
import ar from '../locales/ar';

// ─── Detect device language ───────────────────────────────────────────────────
const deviceLocales  = getLocales();
const primaryLocale  = deviceLocales[0];
const deviceLang     = primaryLocale?.languageCode ?? 'ar'; // default Arabic for Iraq

// Supported language codes → falls back to Arabic if unknown
const SUPPORTED = ['ar', 'en'];
const initialLang = SUPPORTED.includes(deviceLang) ? deviceLang : 'ar';

// ─── i18next configuration ───────────────────────────────────────────────────
i18next
  .use(initReactI18next)
  .init({
    // Translations — flat namespace (no lazy loading needed for 2 locales)
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },

    lng:         initialLang,
    fallbackLng: 'ar',   // Iraqi market: fall back to Arabic

    // Interpolation
    interpolation: {
      escapeValue: false,  // React already escapes
    },

    // Plural rules are not needed for the current dictionary,
    // but i18next handles them automatically if keys use _one/_other suffixes.
    compatibilityJSON: 'v4',
  });

// ─── Convenience exports ──────────────────────────────────────────────────────

/** True when the active language is RTL (Arabic, Farsi, Hebrew, etc.) */
export const isRTL = () => i18next.language === 'ar';

/** Active language code: 'ar' | 'en' */
export const currentLanguage = () => i18next.language;

/** Switch language programmatically (e.g., from a Settings toggle).
 *  NOTE: switching mid-session changes text but does NOT reflow native layout.
 *  To fully flip RTL you must restart the JS bundle (use expo-updates or RNRestart).
 */
export const switchLanguage = async (lang) => {
  if (SUPPORTED.includes(lang)) {
    await i18next.changeLanguage(lang);
  }
};

export default i18next;
