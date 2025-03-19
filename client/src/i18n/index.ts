
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import el from './translations/el.json';
import en from './translations/en.json';

const resources = {
  en: { translation: en },
  el: { translation: el }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'el',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })
  .then(() => {
    i18n.changeLanguage('el');
  });

export default i18n;
