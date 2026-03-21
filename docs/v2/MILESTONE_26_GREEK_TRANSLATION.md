# Milestone 26 — Greek Translation & i18n

| Field | Value |
|-------|-------|
| **Step** | 26 of 26 |
| **Priority** | P3 |
| **Depends on** | Step 5 (Frontend Shell) |
| **Estimated effort** | 4 days |

---

## Goal

Translate the entire application UI into Greek (el-GR), with English (en) retained as the default fallback. Add a language switcher so users can toggle between English and Greek at any time with the preference persisted across sessions. The shipping label service already uses `el-GR` date formatting; that stays as-is.

Library: **`i18next` + `react-i18next`** — industry standard, first-class React support, zero lock-in, supports JSON namespaces and pluralisation out of the box.

---

## Implementation

Greek text runs **20–40% longer** than English on average. Before string extraction begins, the base UI components and tight layouts must be hardened so they flex rather than clip. This is split into two phases: **Phase A — UI hardening** (layout fixes), **Phase B — string extraction** (i18n wiring).

---

### Phase A — UI Hardening for Long Text

#### A1. Base UI Components (`src/client/components/ui/`)

These components are used everywhere. Fixing them here fixes all call sites automatically.

**`badge.tsx`** — remove `whitespace-nowrap` and `overflow-hidden` from the base variant; badges must wrap if the label is long:
```tsx
// Before
"whitespace-nowrap overflow-hidden …"

// After — let badges wrap and size to content
"inline-flex items-center … px-2.5 py-0.5 …"
```

**`button.tsx`** — remove `whitespace-nowrap` from the base class; buttons must expand to fit their label:
```tsx
// Before
"whitespace-nowrap …"

// After
"inline-flex items-center justify-center …"  // no whitespace-nowrap
```

**`table.tsx`** — remove `whitespace-nowrap` from `TableHead` and `TableCell`; allow headers to wrap onto two lines rather than overflow:
```tsx
// TableHead before
"whitespace-nowrap …"
// TableHead after
"align-middle [&:has([role=checkbox])]:pr-0 …"  // no whitespace-nowrap

// TableCell — same fix
```

#### A2. Font Stack — Greek Glyph Support

The app uses Tailwind's default system font stack, which includes Greek-capable fonts on most operating systems, but `font-mono` does not. Add a Greek-friendly monospace fallback in `tailwind.config.ts` (or the CSS base layer):

```css
/* src/client/index.css — add to @layer base */
:root {
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "DejaVu Sans Mono",
               "Liberation Mono", ui-monospace, monospace;
}
```

`DejaVu Sans Mono` and `Liberation Mono` cover the full Greek Unicode block and are available on Linux (the production server). All `font-mono` uses (SKU labels, order numbers, barcode scanner, batch numbers) will render correctly.

#### A3. Sidebar — Tooltip Width

**`Sidebar.tsx` line ~299** — increase collapsed-mode tooltip minimum width to accommodate longer Greek nav labels:
```tsx
// Before
"min-w-[160px]"

// After
"min-w-[200px]"
```

The expanded sidebar (`w-64` = 256 px) fits all Greek navigation strings tested — no change needed. The collapsed icon-only sidebar is unaffected since it shows no text.

#### A4. Sidebar Tooltip Overflow for Nested Labels

Nested navigation items (e.g., "All Orders" → "Όλες οι Παραγγελίες", "Raw Materials" → "Πρώτες Ύλες") can reach ~22 characters in Greek. Add `truncate` with a controlled max width on the tooltip label only (not the sidebar expanded state):
```tsx
<span className="truncate max-w-[220px]">{label}</span>
```

#### A5. Popover Widths — Comboboxes

**`ProductCombobox.tsx`** — increase from `w-96` to `w-[28rem]` (~448 px).
**`CustomerCombobox.tsx`** — increase from `w-72` to `w-80` (320 px).

Greek product and customer names are user data (not translated UI strings) but can be long, and the combobox filter list needs breathing room.

#### A6. Dashboard Stat Cards

**`StatCard.tsx`** — stat card titles are UI strings that will be longer in Greek ("Orders Today" → "Παραγγελίες Σήμερα"). The card title `<p>` should allow wrapping rather than clipping:
```tsx
// Ensure title has no truncate/overflow-hidden; allow up to 2 lines
<p className="text-sm font-medium text-muted-foreground leading-tight">{title}</p>
```

#### A7. Line Item Editor

**`LineItemEditor.tsx`** — the "Avail:" label and `w-20` quantity input:
```tsx
// Replace hardcoded "Avail:" with a translatable key
// w-20 (80px) is sufficient for a numeric input — keep as-is
// whitespace-nowrap on "Avail:" — remove it, the label can wrap on mobile
```

#### A8. Order Items Table — Header Abbreviations

The orders table headers "Est. Ship" and "Items" map to Greek strings "Εκτ. Αποστ." and "Τεμάχια". Allow `TableHead` to break with `break-words` for the longest columns:
```tsx
<TableHead className="break-words min-w-[80px]">…</TableHead>
```

---

### Phase B — String Extraction & i18n Wiring

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

## Files to Modify (UI Hardening)

| Path | Change |
|------|--------|
| `src/client/components/ui/badge.tsx` | Remove `whitespace-nowrap` and `overflow-hidden` from base class |
| `src/client/components/ui/button.tsx` | Remove `whitespace-nowrap` from base class |
| `src/client/components/ui/table.tsx` | Remove `whitespace-nowrap` from `TableHead` and `TableCell` |
| `src/client/index.css` | Add Greek-capable monospace font fallbacks to `--font-mono` |
| `src/client/components/layout/Sidebar.tsx` | Increase collapsed tooltip `min-w` from `160px` to `200px`; add `truncate max-w-[220px]` on tooltip label |
| `src/client/components/orders/ProductCombobox.tsx` | Widen popover from `w-96` to `w-[28rem]` |
| `src/client/components/orders/CustomerCombobox.tsx` | Widen popover from `w-72` to `w-80` |
| `src/client/components/dashboard/StatCard.tsx` | Ensure title `<p>` wraps (no `truncate`, allow 2 lines) |
| `src/client/components/orders/LineItemEditor.tsx` | Remove `whitespace-nowrap` from "Avail:" label |

---

## Verification

1. **Language toggle** — Click the switcher in the header; the entire UI switches between English and Greek immediately without a page reload.
2. **Persistence** — Refresh the page after switching to Greek; the UI stays in Greek.
3. **Fallback** — Remove a key from a Greek locale file; the app falls back to English for that string instead of showing an empty label.
4. **Login page** — Labels, placeholders, and button text appear in both languages; button width expands to fit Greek text.
5. **Dashboard** — Stat card titles wrap cleanly (no overflow) in Greek; all labels translate correctly.
6. **Orders list** — Column headers wrap onto two lines rather than overflowing; status and priority badges expand to fit Greek labels; pagination and empty state translate.
7. **Sidebar navigation** — All group labels and item labels translate; collapsed tooltip shows full Greek label without clipping.
8. **Status/priority badges** — "Αναμονή", "Επείγον", "Υψηλή" render fully inside their badge without being cut off.
9. **Forms** — Field labels, placeholders, and validation messages translate for New Order and New Product forms.
10. **Picking card** — All strings translate; "Complete Order" button expands to accommodate the Greek label.
11. **Monospace text** — Order numbers, SKUs, batch numbers, and barcode scan results render correctly in Greek mode (no missing-glyph boxes).
12. **Date formatting** — Dates in the UI use `el-GR` locale in Greek mode.
13. **Shipping labels** — PDF and ZPL labels unaffected (still `el-GR` regardless of UI language).
14. **TypeScript** — `tsc --noEmit` passes clean after all changes.
15. **No horizontal scroll** — No page in the app introduces horizontal overflow when switched to Greek.

---

## Definition of Done

- [ ] **Phase A — UI hardening complete**
  - [ ] `whitespace-nowrap` removed from Badge, Button, TableHead, TableCell base classes
  - [ ] Greek-capable monospace font fallbacks added to CSS custom property
  - [ ] Sidebar collapsed tooltip widened to `min-w-[200px]`
  - [ ] ProductCombobox and CustomerCombobox popover widths increased
  - [ ] StatCard title allows wrapping; LineItemEditor "Avail:" label wraps
- [ ] **Phase B — i18n wiring complete**
  - [ ] `i18next` and `react-i18next` installed and configured
  - [ ] 13 namespace JSON files created for both `en` and `el` (~1,100 strings total)
  - [ ] All 68 client `.tsx` files use `t()` for every user-visible string
  - [ ] `LanguageSwitcher` component mounted in the app header
  - [ ] Language preference persisted to `localStorage` and restored on load
  - [ ] `toLocaleDateString()` calls pass the active locale
- [ ] `tsc --noEmit` passes clean
- [ ] Manual smoke-test: login, dashboard, orders, picking, and production pages in both languages — no overflows, no missing glyphs, no clipped badges
