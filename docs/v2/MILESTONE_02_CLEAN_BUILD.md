# Milestone 02 — Clean Build (Remove Replit Artifacts)

**Priority:** P0
**Depends on:** Milestone 01 (new repo exists)
**Blocks:** Milestone 03, all subsequent

---

## Objective

Make the project build cleanly in a standard Node.js Docker environment by removing all Replit-specific plugins and patching any Replit assumptions in the code. After this milestone `npm run build` works inside the Docker container with zero errors.

---

## What Needs Changing

### Replit Vite Plugins (3 plugins to remove)

Current `vite.config.ts` includes:
```typescript
import { cartographer } from "@replit/vite-plugin-cartographer";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { shadcnTheme } from "@replit/vite-plugin-shadcn-theme-json";
```

These plugins:
- `cartographer` — Replit code exploration tool (dev only, irrelevant outside Replit)
- `runtime-error-modal` — Replit error overlay (dev only, crashes in Docker)
- `shadcn-theme-json` — Reads `theme.json` and injects CSS variables (can be replaced with static CSS)

### Neon Serverless Config (in `server/db.ts`)

Current `server/db.ts` checks for `neon.tech` in the DATABASE_URL and enables Neon's WebSocket driver. This must be removed.

### Storage Path Assumptions

Current code has hardcoded paths like `/home/runner/workspace/uploads/` that are Replit-specific.

---

## Step 1 — Fix `vite.config.ts`

Replace the entire file with a clean version:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    // NOTE: Removed Replit-specific plugins:
    // - @replit/vite-plugin-cartographer
    // - @replit/vite-plugin-runtime-error-modal
    // - @replit/vite-plugin-shadcn-theme-json
  ],

  root: path.resolve(__dirname, "client"),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },

  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
          ],
          "query-vendor": ["@tanstack/react-query"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "date-vendor": ["date-fns", "react-day-picker"],
          "chart-vendor": ["recharts"],
          "router-vendor": ["wouter"],
          "icons-vendor": ["lucide-react"],
        },
      },
    },
    // Warn if chunks exceed 500KB
    chunkSizeWarningLimit: 500,
  },

  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
```

---

## Step 2 — Remove Replit Packages from `package.json`

Remove from `devDependencies`:
```json
"@replit/vite-plugin-cartographer": "...",
"@replit/vite-plugin-runtime-error-modal": "...",
"@replit/vite-plugin-shadcn-theme-json": "..."
```

Then run:
```bash
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-shadcn-theme-json
```

---

## Step 3 — Handle `theme.json` (shadcn theme)

The Replit shadcn plugin reads `theme.json` and injects CSS variables. In V2, handle this manually.

### Option A — Convert to CSS Variables (Recommended)

1. Run the existing app locally once and inspect the `<style>` tag injected by the Replit plugin in the browser
2. Copy those CSS variable declarations
3. Add them to `client/src/index.css` directly in the `:root` and `.dark` selectors

Example of what you'll find and copy:
```css
/* Add to client/src/index.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  /* ... etc. */
}
.dark {
  --background: 222.2 84% 4.9%;
  /* ... etc. */
}
```

### Option B — Write a Simple Vite Plugin Replacement

If the theme.json is complex, write a small Vite plugin that reads it:

```typescript
// vite-plugins/theme-json.ts
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

export function themeJsonPlugin(): Plugin {
  return {
    name: 'theme-json',
    transformIndexHtml() {
      const themeJson = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), 'theme.json'), 'utf-8')
      );
      // Generate CSS variables from theme.json
      const cssVars = Object.entries(themeJson)
        .map(([key, val]) => `  --${key}: ${val};`)
        .join('\n');
      return [
        {
          tag: 'style',
          attrs: { 'data-theme': 'true' },
          children: `:root {\n${cssVars}\n}`,
        },
      ];
    },
  };
}
```

---

## Step 4 — Fix `server/db.ts` (Remove Neon Config)

Find and remove the Neon-specific block:

```typescript
// REMOVE THIS ENTIRE BLOCK:
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

if (process.env.DATABASE_URL?.includes('neon.tech')) {
  neonConfig.webSocketConstructor = ws;
  log('Using Neon serverless WebSocket configuration', 'database');
}
```

Also remove from package.json if present:
```json
"@neondatabase/serverless": "..."
```

The `drizzle-orm/node-postgres` driver (standard PostgreSQL) is already configured and will work fine with the local Docker PostgreSQL container.

---

## Step 5 — Fix Hardcoded Replit Storage Paths

Search for any hardcoded Replit paths:

```bash
grep -rn "home/runner\|replit\.dev\|\.replit\|REPL_ID\|REPL_OWNER" server/ client/ --include="*.ts" --include="*.tsx"
```

For each occurrence, replace with `process.env.STORAGE_PATH || path.join(process.cwd(), 'storage')`.

Key files to check:
- `server/api/imageUploadFix.ts`
- `server/api/products.ts`
- `server/services/labelPrinterService.ts`
- Any other file that constructs file paths

---

## Step 6 — Fix `package.json` Scripts

Update the scripts section for Docker-friendly builds:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "NODE_ENV=development tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "esbuild server/index.ts --platform=node --format=esm --bundle --outfile=dist/index.js --external:pg-native",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx server/db-migrate.ts"
  }
}
```

Note: Remove all Replit-specific scripts like `build-for-replit.sh`, etc.

---

## Step 7 — Fix `tsconfig.json` Path Aliases

Ensure path aliases work in both client and server:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    },
    "outDir": "./dist",
    "rootDir": ".",
    "composite": false
  },
  "include": [
    "client/src/**/*",
    "server/**/*",
    "shared/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

---

## Step 8 — Verify the Build

```bash
# Inside Docker or locally with Node 20
npm ci
npm run build

# Expected output:
# ✓ client built in dist/public/
# ✓ server built as dist/index.js
# No errors about missing @replit/* packages
# No errors about neon.tech / WebSocket
```

---

## Step 9 — Test Server Starts

```bash
# Set minimum env vars
export DATABASE_URL="postgresql://amphoreus:password@localhost:5432/amphoreus"
export SESSION_SECRET="test-secret-at-least-32-chars-long"
export NODE_ENV="production"

node dist/index.js
# Expected: Server listening on port 5000
# No Replit/Neon related startup errors
```

---

## Files Modified in This Milestone

```
amphoreus-v2/
├── vite.config.ts              ← MODIFIED: Remove 3 Replit plugins
├── package.json                ← MODIFIED: Remove @replit/* packages, clean scripts
├── tsconfig.json               ← MODIFIED: Clean path aliases
├── server/db.ts                ← MODIFIED: Remove Neon WebSocket block
├── server/api/imageUploadFix.ts ← MODIFIED: Use STORAGE_PATH env var
├── server/api/products.ts      ← MODIFIED: Use STORAGE_PATH env var
└── client/src/index.css        ← MODIFIED: Add theme CSS variables (from theme.json)
```

---

## Next Milestone

→ [MILESTONE_03_ENV_CONFIG.md](./MILESTONE_03_ENV_CONFIG.md) — Environment variables and configuration
