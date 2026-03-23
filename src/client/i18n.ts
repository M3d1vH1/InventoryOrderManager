import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// en
import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enAuth from "./locales/en/auth.json";
import enDashboard from "./locales/en/dashboard.json";
import enOrders from "./locales/en/orders.json";
import enProducts from "./locales/en/products.json";
import enCustomers from "./locales/en/customers.json";
import enPicking from "./locales/en/picking.json";
import enShipping from "./locales/en/shipping.json";
import enProduction from "./locales/en/production.json";
import enSuppliers from "./locales/en/suppliers.json";
import enAnalytics from "./locales/en/analytics.json";
import enScanning from "./locales/en/scanning.json";

// el
import elCommon from "./locales/el/common.json";
import elNav from "./locales/el/nav.json";
import elAuth from "./locales/el/auth.json";
import elDashboard from "./locales/el/dashboard.json";
import elOrders from "./locales/el/orders.json";
import elProducts from "./locales/el/products.json";
import elCustomers from "./locales/el/customers.json";
import elPicking from "./locales/el/picking.json";
import elShipping from "./locales/el/shipping.json";
import elProduction from "./locales/el/production.json";
import elSuppliers from "./locales/el/suppliers.json";
import elAnalytics from "./locales/el/analytics.json";
import elScanning from "./locales/el/scanning.json";

const STORAGE_KEY = "amphoreus_lang";
const savedLang = localStorage.getItem(STORAGE_KEY) ?? "en";

i18n.use(initReactI18next).init({
    lng: savedLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React handles XSS
    resources: {
        en: {
            common: enCommon, nav: enNav, auth: enAuth,
            dashboard: enDashboard, orders: enOrders, products: enProducts,
            customers: enCustomers, picking: enPicking, shipping: enShipping,
            production: enProduction, suppliers: enSuppliers,
            analytics: enAnalytics, scanning: enScanning,
        },
        el: {
            common: elCommon, nav: elNav, auth: elAuth,
            dashboard: elDashboard, orders: elOrders, products: elProducts,
            customers: elCustomers, picking: elPicking, shipping: elShipping,
            production: elProduction, suppliers: elSuppliers,
            analytics: elAnalytics, scanning: elScanning,
        },
    },
});

// Persist preference
i18n.on("languageChanged", (lang) => localStorage.setItem(STORAGE_KEY, lang));

export default i18n;
