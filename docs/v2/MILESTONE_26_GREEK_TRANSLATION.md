# Milestone 26 — Greek Translation & i18n

| Field | Value |
|-------|-------|
| **Step** | 26 of 26 |
| **Priority** | P3 |
| **Depends on** | Step 5 (Frontend Shell) |
| **Estimated effort** | 3 days |

---

## Goal

Translate the entire application UI into Greek (el-GR), with English (en) retained as the default fallback. Add a language switcher so users can toggle between English and Greek at any time with the preference persisted across sessions. The shipping label service already uses `el-GR` date formatting; that stays as-is.

Library: **`i18next` + `react-i18next`** — industry standard, first-class React support, zero lock-in, supports JSON namespaces and pluralisation out of the box.

---

## Implementation

### 1. Install Dependencies

```bash
npm install i18next react-i18next
```

No type packages needed — both ship bundled TypeScript declarations.

---

### 2. Locale File Structure

```
src/client/locales/
  en/
    common.json       — shared: Save, Cancel, Delete, Back, Edit, Loading…
    nav.json          — sidebar navigation labels
    auth.json         — login page
    dashboard.json    — dashboard stats and headings
    orders.json       — orders list, new order, order detail
    products.json     — products list, form, stock status labels
    customers.json    — customers list and form
    picking.json      — picking queue and card
    shipping.json     — shipping labels dialog
    production.json   — batches, recipes, raw materials
    suppliers.json    — suppliers, invoices, payments
    analytics.json    — analytics dashboard
    scanning.json     — barcode scanner
  el/
    common.json
    nav.json
    auth.json
    dashboard.json
    orders.json
    products.json
    customers.json
    picking.json
    shipping.json
    production.json
    suppliers.json
    analytics.json
    scanning.json
```

Example `en/common.json`:
```json
{
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "back": "Back",
  "edit": "Edit",
  "create": "Create",
  "loading": "Loading…",
  "error": "Something went wrong",
  "noResults": "No results found",
  "search": "Search…",
  "previous": "Previous",
  "next": "Next",
  "pageOf": "Page {{current}} of {{total}}"
}
```

Example `el/common.json`:
```json
{
  "save": "Αποθήκευση",
  "cancel": "Ακύρωση",
  "delete": "Διαγραφή",
  "back": "Πίσω",
  "edit": "Επεξεργασία",
  "create": "Δημιουργία",
  "loading": "Φόρτωση…",
  "error": "Κάτι πήγε στραβά",
  "noResults": "Δεν βρέθηκαν αποτελέσματα",
  "search": "Αναζήτηση…",
  "previous": "Προηγούμενο",
  "next": "Επόμενο",
  "pageOf": "Σελίδα {{current}} από {{total}}"
}
```

---

### 3. i18n Configuration — `src/client/i18n.ts`

```ts
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
```

---

### 4. Bootstrap — `src/client/main.tsx`

Import `./i18n` before the React tree renders:

```ts
import "./i18n"; // must come before App
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
```

---

### 5. String Extraction — All Client Components

For each `.tsx` file, wrap hardcoded strings with `useTranslation`:

```tsx
// Before
import { useTranslation } from "react-i18next";

// After — at the top of every component that has UI text
const { t } = useTranslation("orders"); // use the matching namespace

// Usage
<h1>{t("title")}</h1>               // "Orders" / "Παραγγελίες"
<Button>{t("common:save")}</Button>  // cross-namespace with prefix
```

**Priority order for extraction (by user-facing impact):**

1. `nav.json` — Sidebar (everyone sees it on every page)
2. `auth.json` — Login page
3. `common.json` — Shared buttons/states (reused everywhere)
4. `dashboard.json` — Landing page after login
5. `orders.json`, `products.json`, `customers.json` — Core workflow
6. `picking.json`, `shipping.json` — Warehouse ops
7. `production.json`, `suppliers.json` — Back-office
8. `analytics.json`, `scanning.json` — Secondary features

---

### 6. Language Switcher Component — `src/client/components/shared/LanguageSwitcher.tsx`

```tsx
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const isGreek = i18n.language === "el";

    return (
        <button
            onClick={() => i18n.changeLanguage(isGreek ? "en" : "el")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
            aria-label="Toggle language"
        >
            <span className="text-base">{isGreek ? "🇬🇧" : "🇬🇷"}</span>
            <span>{isGreek ? "EN" : "ΕΛ"}</span>
        </button>
    );
}
```

Mount it in the top-right corner of the app header (next to the user menu).

---

### 7. Date Formatting

Replace bare `toLocaleDateString()` calls with locale-aware formatting:

```tsx
// Before
new Date(order.createdAt).toLocaleDateString()

// After — reads the active i18n language
const { i18n } = useTranslation();
new Date(order.createdAt).toLocaleDateString(i18n.language === "el" ? "el-GR" : "en-GB")
```

The `labelService.ts` server-side labels already use `"el-GR"` and do not need to change (labels are always in Greek per business requirement).

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/client/i18n.ts` | i18next configuration and bootstrapping |
| `src/client/locales/en/common.json` | English shared strings |
| `src/client/locales/en/nav.json` | English navigation labels |
| `src/client/locales/en/auth.json` | English auth page |
| `src/client/locales/en/dashboard.json` | English dashboard |
| `src/client/locales/en/orders.json` | English orders module |
| `src/client/locales/en/products.json` | English products module |
| `src/client/locales/en/customers.json` | English customers module |
| `src/client/locales/en/picking.json` | English picking module |
| `src/client/locales/en/shipping.json` | English shipping module |
| `src/client/locales/en/production.json` | English production module |
| `src/client/locales/en/suppliers.json` | English suppliers module |
| `src/client/locales/en/analytics.json` | English analytics module |
| `src/client/locales/en/scanning.json` | English scanning module |
| `src/client/locales/el/*.json` | Greek translations for all 13 namespaces |
| `src/client/components/shared/LanguageSwitcher.tsx` | EN/GR toggle button |

## Files to Modify

| Path | Change |
|------|--------|
| `src/client/main.tsx` | Import `./i18n` before App renders |
| `amphoreus-v2/package.json` | Add `i18next` and `react-i18next` to dependencies |
| All 68 `src/client/**/*.tsx` files | Replace hardcoded strings with `t()` calls |
| `src/client/components/layout/Header.tsx` | Mount `<LanguageSwitcher />` |

---

## Verification

1. **Language toggle** — Click the switcher in the header; the entire UI switches between English and Greek immediately without a page reload.
2. **Persistence** — Refresh the page after switching to Greek; the UI stays in Greek.
3. **Fallback** — Remove a key from a Greek locale file; the app falls back to English for that string instead of showing an empty label.
4. **Login page** — Verify labels, placeholders, and button text appear in both languages.
5. **Dashboard** — All stat card labels and headings translate correctly.
6. **Orders list** — Column headers, status tabs, pagination, and empty state message all translate.
7. **Sidebar navigation** — All navigation group labels and item labels translate.
8. **Forms** — Field labels, placeholders, and validation messages translate for at least New Order and New Product forms.
9. **Picking card** — "Mark as Picked", "Scan barcode to find item", progress label, and Complete Order button translate.
10. **Date formatting** — Dates rendered in the UI use `el-GR` locale in Greek mode (e.g. `12/3/2026` vs `12 Μαρτίου 2026`).
11. **Shipping labels** — PDF and ZPL labels are unaffected (still use `el-GR` regardless of UI language).
12. **TypeScript** — `tsc --noEmit` passes clean after all string extraction.

---

## Definition of Done

- [ ] `i18next` and `react-i18next` installed and configured
- [ ] 13 namespace JSON files created for both `en` and `el` (~1,100 strings total)
- [ ] All 68 client `.tsx` files use `t()` for every user-visible string
- [ ] `LanguageSwitcher` component mounted in the app header
- [ ] Language preference persisted to `localStorage` and restored on load
- [ ] `toLocaleDateString()` calls pass the active locale
- [ ] `tsc --noEmit` passes clean
- [ ] Manual smoke-test across login, dashboard, orders, picking, and production in both languages
