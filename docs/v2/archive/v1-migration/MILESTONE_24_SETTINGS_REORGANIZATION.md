# MILESTONE 24 — Settings Reorganization & Login Cleanup

**Step:** 24 of 25
**Priority:** P3
**Depends on:** Milestone 12 (Frontend Cleanup)
**Estimated effort:** 1 day

---

## Problem

### Issue 1: Settings page has 9 flat tabs with no visual grouping

Current tabs: Notifications, Company, Email, RBAC, Audit Trail, System, Performance, Labels, Images

The Notifications tab alone contains approximately 30 toggle/input fields and 7 Slack message template textareas. There is no progressive disclosure — opening the Settings page dumps the user into the most complex section immediately.

A new admin cannot tell which settings are routine ("Company name, logo"), which are dangerous ("RBAC roles"), and which are rare technical tweaks ("Performance tuning", "Structured logging").

### Issue 2: Login page exposes app theming controls to end users

`Login.tsx` currently shows:
- Background style selector (solid color, gradient, image, etc.)
- Dark mode toggle
- Logo color selector

These were developer-era controls added during UI prototyping. They are visible to every user who visits the login page — before they are even authenticated. A user who accidentally changes the background style sees a different login page until they clear localStorage.

---

## Solution

### Part A — Group the 9 Settings tabs into 4 logical sections

Use a two-level navigation: a **section list** on the left (or top-level tabs) and **sub-tabs** within each section.

**Proposed grouping:**

| Section | Current Tabs Included |
|---|---|
| **Alerts & Integrations** | Notifications, Email |
| **Company** | Company, Labels, Images |
| **Admin** | RBAC, Audit Trail |
| **System** | System, Performance |

This reduces the cognitive load from "9 things" to "4 things, each with sub-sections".

### Part B — Remove login page theming controls

Move background/dark mode/logo color settings into `Settings → Company` tab, visible only to admins. Remove them from `Login.tsx` entirely.

---

## Implementation

### Part A — Settings two-level navigation

**Option 1 (Recommended): Top-level section tabs + inner tabs per section**

```typescript
// client/src/pages/Settings.tsx

type SettingsSection = "alerts" | "company" | "admin" | "system";
type SettingsTab = string; // varies per section

const SECTIONS: {
  key: SettingsSection;
  label: string;
  icon: React.ComponentType;
  tabs: { key: string; label: string; component: React.ComponentType }[];
}[] = [
  {
    key: "alerts",
    label: "Alerts & Integrations",
    icon: Bell,
    tabs: [
      { key: "notifications", label: "Notifications", component: NotificationsTab },
      { key: "email", label: "Email", component: EmailTab },
    ],
  },
  {
    key: "company",
    label: "Company",
    icon: Building2,
    tabs: [
      { key: "company", label: "Company Profile", component: CompanyTab },
      { key: "labels", label: "Labels", component: LabelsTab },
      { key: "images", label: "Images", component: ImagesTab },
      { key: "appearance", label: "Appearance", component: AppearanceTab }, // NEW — moved from Login
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: Shield,
    tabs: [
      { key: "rbac", label: "User Roles", component: RBACTab },
      { key: "audit", label: "Audit Trail", component: AuditTrailTab },
    ],
  },
  {
    key: "system",
    label: "System",
    icon: Settings2,
    tabs: [
      { key: "system", label: "System", component: SystemTab },
      { key: "performance", label: "Performance", component: PerformanceTab },
    ],
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("alerts");
  const [activeTab, setActiveTab] = useState<string>("notifications");

  const currentSection = SECTIONS.find(s => s.key === activeSection)!;
  const currentTab = currentSection.tabs.find(t => t.key === activeTab);

  // When section changes, auto-select its first tab
  function handleSectionChange(section: SettingsSection) {
    setActiveSection(section);
    const s = SECTIONS.find(s => s.key === section)!;
    setActiveTab(s.tabs[0].key);
  }

  return (
    <div className="flex h-full">
      {/* Section selector — left sidebar on md+, horizontal tabs on mobile */}
      <nav className="hidden md:flex flex-col w-48 border-r border-gray-200 bg-gray-50 shrink-0">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <button
              key={section.key}
              onClick={() => handleSectionChange(section.key)}
              className={`
                flex items-center gap-3 px-4 py-3 text-sm font-medium text-left
                border-l-2 transition-colors
                ${activeSection === section.key
                  ? "border-blue-600 text-blue-700 bg-blue-50"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {section.label}
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sub-tabs (within the current section) */}
        {currentSection.tabs.length > 1 && (
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-0">
              {currentSection.tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.key
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentTab && <currentTab.component />}
        </div>
      </div>
    </div>
  );
}
```

**Mobile section selector** — show horizontal scrollable tabs at the top on small screens (add `md:hidden` version):
```typescript
<div className="md:hidden border-b border-gray-200 overflow-x-auto">
  <div className="flex">
    {SECTIONS.map(section => (
      <button
        key={section.key}
        onClick={() => handleSectionChange(section.key)}
        className={`
          shrink-0 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap
          ${activeSection === section.key
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-gray-500"
          }
        `}
      >
        {section.label}
      </button>
    ))}
  </div>
</div>
```

### Part B — Notifications tab: progressive disclosure

The Notifications tab has ~30 fields including 7 Slack message template textareas. Add collapsible sections within the tab:

```typescript
// NotificationsTab.tsx — wrap each category in a collapsible section

function NotificationSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// Usage inside NotificationsTab:
<NotificationSection title="Order Alerts" defaultOpen={true}>
  {/* order-related toggles */}
</NotificationSection>

<NotificationSection title="Inventory Alerts">
  {/* stock level threshold fields */}
</NotificationSection>

<NotificationSection title="Slack Templates" description="Message templates sent to Slack for each event type">
  {/* 7 textareas */}
</NotificationSection>

<NotificationSection title="Email Notifications">
  {/* email toggles */}
</NotificationSection>
```

### Part C — New `AppearanceTab` in Company section

Move the theming controls from Login.tsx to a new tab under the Company section. Only admins should see the Settings page at all (already gated), so this is inherently protected.

```typescript
// client/src/components/settings/AppearanceTab.tsx

export function AppearanceTab() {
  // Read current values from localStorage or a settings API endpoint
  const [bgStyle, setBgStyle] = useLocalStorage("login_bg_style", "gradient");
  const [logoColor, setLogoColor] = useLocalStorage("login_logo_color", "blue");

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Login Page Background</h3>
        <p className="text-xs text-gray-500 mb-3">
          Applies to the login page for all users.
        </p>
        <Select value={bgStyle} onValueChange={setBgStyle}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="image">Background Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Logo Accent Color</h3>
        <div className="flex gap-3 flex-wrap">
          {["blue", "green", "purple", "red", "orange"].map(color => (
            <button
              key={color}
              onClick={() => setLogoColor(color)}
              className={`
                w-8 h-8 rounded-full border-2 transition-transform
                ${logoColor === color ? "border-gray-900 scale-110" : "border-transparent"}
              `}
              style={{ backgroundColor: colorMap[color] }}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Part D — Remove theming controls from `Login.tsx`

```typescript
// Login.tsx — REMOVE all of this:
const [bgStyle, setBgStyle] = useState("gradient");
const [darkMode, setDarkMode] = useState(false);
const [logoColor, setLogoColor] = useState("blue");

// And remove all JSX rendering the selectors/toggles from the login card.
```

The login page should be a plain form: username, password, submit button. Any branding choices (logo, background) should be read from a settings API or localStorage that was set by an admin — not configured inline by the end user.

---

## Files to Modify / Create

| File | Change |
|---|---|
| `client/src/pages/Settings.tsx` | Replace flat 9-tab layout with 4-section + sub-tab layout |
| `client/src/components/settings/NotificationsTab.tsx` | Add collapsible sections within the tab |
| `client/src/components/settings/AppearanceTab.tsx` | **Create new** — moved from Login.tsx |
| `client/src/pages/Login.tsx` | Remove all theming controls |

All existing tab content components (`CompanyTab`, `EmailTab`, `RBACTab`, etc.) are unchanged — only the Settings page's navigation structure changes.

---

## Verification

1. **Settings layout:** The Settings page shows 4 section items in a left sidebar (Alerts & Integrations, Company, Admin, System). Clicking "Admin" shows two sub-tabs: User Roles, Audit Trail.

2. **Notifications progressive disclosure:** The Notifications tab shows 4 collapsed sections. "Order Alerts" is expanded by default. Clicking "Slack Templates" expands to show the 7 textareas.

3. **Login page is clean:** The login page shows only username, password, and a submit button. There are no style selectors, color pickers, or dark mode toggles.

4. **Appearance settings:** Log in as admin, navigate to Settings → Company → Appearance. The background style and logo color controls are present.

5. **Mobile Settings:** On a 375px screen, the section selector renders as horizontal scrollable tabs across the top.

6. **All 9 original tabs still accessible:** Every piece of configuration that was in the original 9 tabs is still reachable under the new 4-section structure.

---

## Definition of Done

- [ ] Settings page uses 4-section navigation (Alerts & Integrations, Company, Admin, System)
- [ ] Left sidebar navigation on desktop, horizontal scrollable tabs on mobile
- [ ] All 9 original tabs are accessible within the new structure, content unchanged
- [ ] Notifications tab has collapsible sub-sections (Order Alerts, Inventory Alerts, Slack Templates, Email)
- [ ] New `AppearanceTab` under Company with background style + logo color controls
- [ ] `Login.tsx` has no style selectors, dark mode toggle, or logo color picker
- [ ] Login page shows only: logo, username field, password field, submit button
