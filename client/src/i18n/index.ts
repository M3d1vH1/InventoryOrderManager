
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import el from './translations/el.json';
import en from './translations/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      el: { translation: el }
    },
    lng: 'el',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })
  .then(() => {
    // Force Greek language after initialization
    i18n.changeLanguage('el');
    localStorage.setItem('i18nextLng', 'el');
  });

export default i18n;
