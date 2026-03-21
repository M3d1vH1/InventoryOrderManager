# Milestone 27 — Product Images

| Field | Value |
|-------|-------|
| **Step** | 27 of 27 |
| **Priority** | P2 |
| **Depends on** | Step 6 (Products & Inventory) |
| **Estimated effort** | 2 days |

---

## Goal

Allow staff to upload an image per product. Images are processed server-side into two optimised WebP variants (thumbnail and full-size), stored on Cloudflare R2, and served via Cloudflare's edge network so they load instantly regardless of where the app server is. The `ProductCard` and product detail page display the correct variant automatically.

---

## Why Cloudflare R2?

The app already runs behind a Cloudflare Tunnel. R2 is Cloudflare's S3-compatible object storage:

- **Free tier** — 10 GB storage, 1 M write ops, 10 M read ops per month (easily covers hundreds of product images)
- **Zero egress fees** — unlike AWS S3, there is no charge to download images
- **Cloudflare edge delivery** — a public R2 bucket or custom domain is served from Cloudflare's global CDN automatically; no extra CDN configuration needed
- **S3-compatible API** — use the standard `@aws-sdk/client-s3` package, so switching to another S3-compatible provider later (MinIO, AWS, Backblaze B2) requires only env-var changes

### Simpler alternative (no R2 account yet)

If R2 is not set up yet, the upload endpoint can instead write files to `public/uploads/products/` and serve them via the existing Hono static handler. This is zero-config but means images are stored on the app server's local disk (fine for development and small deployments; not ideal if the app ever runs across multiple replicas). The code path is identical except the "upload to R2" step is replaced with `fs.writeFile`. The milestone is designed so this swap requires changing only `imageService.ts`.

---

## Implementation

### 1. Dependencies

```bash
# Server — image processing + S3-compatible upload client
npm install sharp @aws-sdk/client-s3 @aws-sdk/lib-storage

# No new client dependencies — native File API + fetch
```

`sharp` is a libvips binding; it is the fastest Node.js image processor and produces the smallest WebP output. It installs a prebuilt native binary for the platform so no compiler is needed. **Do not install `@types/sharp`** — `sharp` ≥ 0.29 ships its own bundled TypeScript declarations; installing `@types/sharp` alongside it creates conflicting duplicate type definitions and will cause `tsc` errors.

---

### 2. Environment Variables

Add to `.env.example` and `src/server/lib/env.ts`:

```bash
# Cloudflare R2 — create a bucket named "amphoreus-products" in the CF dashboard
# Account ID and keys: R2 → Manage R2 API Tokens
R2_ACCOUNT_ID=your_cf_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=amphoreus-products
# Public URL for the bucket (set after enabling public access in CF dashboard)
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

`src/server/lib/env.ts` — add to the Zod schema as **optional** so the app starts without R2 configured (local-disk fallback is still usable):

```typescript
R2_ACCOUNT_ID: z.string().min(1).optional(),
R2_ACCESS_KEY_ID: z.string().min(1).optional(),
R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
R2_BUCKET_NAME: z.string().min(1).optional(),
R2_PUBLIC_URL: z.string().url().optional(),
```

`imageService.ts` must check these at call time and throw a clear error if an upload is attempted without R2 configured (see Section 3 below). Making them required in Zod causes the app to refuse to start at all — unacceptable during development or when using the local-disk fallback.

---

### 3. Image Service (`src/server/services/imageService.ts`)

Handles all image I/O. Keeping it in one file means switching from R2 to local disk (or any other backend) is a one-file change.

```typescript
import sharp from "sharp";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../lib/env";

// Two stored variants per product image:
//   <uuid>-card.webp   400 px wide  — ProductCard grid/list view
//   <uuid>-full.webp  1200 px wide  — product detail page lightbox
export const CARD_WIDTH = 400;
export const FULL_WIDTH = 1200;
const WEBP_QUALITY = 82; // good perceptual quality at ~30-50% smaller than JPEG

// Lazy-initialised so the module can be imported even when R2 is not configured.
// An error is thrown only when an upload is actually attempted.
function getS3Client(): S3Client {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env"
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadProductImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ cardUrl: string; fullUrl: string }> {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, WebP, or AVIF.");
  }
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    throw new Error("Image must be smaller than 10 MB.");
  }

  const uuid = crypto.randomUUID();

  // Process both sizes in parallel — sharp is non-blocking
  const [cardBuf, fullBuf] = await Promise.all([
    sharp(buffer)
      .rotate() // auto-rotate from EXIF orientation
      .resize(CARD_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer(),
    sharp(buffer)
      .rotate()
      .resize(FULL_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer(),
  ]);

  const cardKey = `products/${uuid}-card.webp`;
  const fullKey = `products/${uuid}-full.webp`;

  await Promise.all([
    uploadToR2(cardKey, cardBuf),
    uploadToR2(fullKey, fullBuf),
  ]);

  return {
    cardUrl: `${env.R2_PUBLIC_URL}/${cardKey}`,
    fullUrl: `${env.R2_PUBLIC_URL}/${fullKey}`,
  };
}

export async function deleteProductImage(cardUrl: string): Promise<void> {
  // Only attempt deletion if this looks like an R2-managed URL (contains our key pattern).
  // Legacy products may have external image URLs — skip deletion for those.
  if (!env.R2_PUBLIC_URL || !cardUrl.startsWith(env.R2_PUBLIC_URL)) return;

  const cardKey = cardUrl.replace(`${env.R2_PUBLIC_URL}/`, "");
  const fullKey = cardKey.replace("-card.webp", "-full.webp");
  const s3 = getS3Client();
  await Promise.allSettled([
    s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: cardKey })),
    s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: fullKey })),
  ]);
  // allSettled — don't throw if the object was already deleted
}

async function uploadToR2(key: string, body: Buffer): Promise<void> {
  const upload = new Upload({
    client: getS3Client(),
    params: {
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      // immutable — the UUID in the key guarantees uniqueness; safe to cache forever
    },
  });
  await upload.done();
}
```

---

### 4. Upload Endpoint (`src/server/index.ts`)

tRPC does not support binary file uploads. Add a plain Hono route **before the tRPC mount** (around line 50, after the health check). `sessionMiddleware` is already applied globally to all routes — no need to add it here again.

```typescript
import { uploadProductImage } from "./services/imageService.js";

// POST /api/upload/product-image
// Note: sessionMiddleware is already applied globally via app.use("*", sessionMiddleware)
app.post("/api/upload/product-image", async (c) => {
  // Require authentication — sessionMiddleware populates c.get("user")
  if (!c.get("user")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const formData = await c.req.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return c.json({ error: "No image file provided." }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadProductImage(buffer, file.type);
    return c.json(result); // { cardUrl, fullUrl }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return c.json({ error: message }, 400);
  }
});
```

---

### 5. tRPC Product Router — Cleanup on Delete/Replace

**`src/server/routers/products.ts`** — add image deletion in two places.

> **Field name note:** The tRPC input schema uses `imageUrl` (maps to `products.imagePath` in the DB). When reading back from the DB, the column comes through as `imagePath`. Keep this distinction in mind.

```typescript
import { deleteProductImage } from "../services/imageService.js";

// In the update mutation — fetch the existing row first, then check if imageUrl changed
// `input.imageUrl` is the new URL; `existing.imagePath` is the old stored URL
if (input.imageUrl !== undefined && existing.imagePath && existing.imagePath !== input.imageUrl) {
  await deleteProductImage(existing.imagePath).catch(() => {}); // fire-and-forget, don't block save
}

// In the delete mutation — after db.delete() returns the deleted row via .returning()
if (deletedProduct.imagePath) {
  await deleteProductImage(deletedProduct.imagePath).catch(() => {});
}
```

---

### 6. Database Schema — No Migration Required

`products.imagePath` already exists as a `text` column. We store the **card URL** there. All existing tRPC code surfaces this column as `imageUrl` (the Drizzle select aliases it). The full URL is derived client-side from the card URL.

Add a typed helper to `src/shared/utils.ts` (create the file if it doesn't exist at `src/shared/utils.ts`):

```typescript
export function productFullImageUrl(cardUrl: string): string {
  // Only transform R2-managed URLs that follow our naming convention.
  // Legacy/external URLs are returned unchanged — they don't have a separate full-size variant.
  if (cardUrl.includes("-card.webp")) {
    return cardUrl.replace("-card.webp", "-full.webp");
  }
  return cardUrl;
}
```

The existing tRPC Zod input schema for `imageUrl` is already `z.string().url().optional()` — no change needed there.

---

### 7. Frontend — ImageUploadField Component

New component: `src/client/components/products/ImageUploadField.tsx`

```tsx
import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Upload, X } from "lucide-react";

interface Props {
  value: string | null;        // current cardUrl stored in form
  onChange: (url: string | null) => void;
}

export function ImageUploadField({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/upload/product-image", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      onChange(json.cardUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-40">
          <img
            src={value}
            alt="Product"
            className="rounded-lg object-cover w-40 h-40 border"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 shadow-sm hover:bg-red-50"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          <Upload className="w-6 h-6 mb-2" />
          <span className="text-xs text-center px-2">
            {uploading ? "Uploading…" : "Click to upload"}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // allow re-selecting same file
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

---

### 8. ProductForm — Wire Up the Upload Field

**`src/client/components/products/ProductForm.tsx`**

The existing form uses `react-hook-form` with `form.register()` directly (not the shadcn `<FormField>` wrapper). Use `Controller` for the upload field since `ImageUploadField` is a controlled component (not a native input).

**Step 1 — Update imports:**
```tsx
import { useForm, Controller } from "react-hook-form";
import { ImageUploadField } from "./ImageUploadField";
```

**Step 2 — Update the Zod schema** (the field is `imageUrl` in the form schema — matches the tRPC input):
```tsx
// Replace:
imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),

// With:
imageUrl: z.string().url().nullable().optional(),
```

**Step 3 — Update the default values:**
```tsx
// Replace:
imageUrl: initialData?.imageUrl || "",

// With:
imageUrl: initialData?.imageUrl ?? null,
```

**Step 4 — Update the submit handler** (remove the empty-string conversion, use null instead):
```tsx
// Replace:
const payload = {
  ...data,
  imageUrl: data.imageUrl === "" ? undefined : data.imageUrl,
};

// With:
const payload = {
  ...data,
  imageUrl: data.imageUrl ?? undefined, // null → undefined so tRPC treats it as absent
};
```

**Step 5 — Replace the Image URL `<div>` in the JSX:**
```tsx
{/* Replace the entire "Image URL" div block with: */}
<div className="space-y-2 md:col-span-2">
  <Label>Product Image</Label>
  <Controller
    control={form.control}
    name="imageUrl"
    render={({ field }) => (
      <ImageUploadField
        value={field.value ?? null}
        onChange={field.onChange}
      />
    )}
  />
  {form.formState.errors.imageUrl && (
    <p className="text-red-600 text-sm">{form.formState.errors.imageUrl.message}</p>
  )}
</div>
```

---

### 9. ProductCard — Performance Attributes

**`src/client/components/products/ProductCard.tsx`**

The image rendering is already in place. Add `loading`, `decoding`, and a fixed aspect ratio to prevent layout shift:

```tsx
<img
  src={product.imageUrl}
  alt={product.name}
  loading="lazy"
  decoding="async"
  className={cn(
    "object-cover rounded bg-gray-100",
    viewMode === "list" ? "h-16 w-16 shrink-0" : "h-40 w-full"
  )}
/>
```

The placeholder `<div>` already sets the same dimensions so there is no layout shift when images are absent.

---

### 10. Product Detail Page — Full-Size Image

**`src/client/routes/_auth/products/$productId.tsx`**

The tRPC query returns `imageUrl` (aliased from `imagePath` in the DB). Use that field:

```tsx
import { productFullImageUrl } from "../../../../shared/utils";

// In the product detail JSX:
{product.imageUrl && (
  <img
    src={productFullImageUrl(product.imageUrl)}
    alt={product.name}
    loading="eager"
    decoding="async"
    className="rounded-xl object-cover w-full max-w-sm border shadow-sm"
  />
)}
```

---

## Files to Create / Modify

| Path | Action |
|------|--------|
| `src/server/services/imageService.ts` | **Create** — R2 upload + deletion |
| `src/server/index.ts` | **Modify** — add `POST /api/upload/product-image` route |
| `src/server/routers/products.ts` | **Modify** — delete old R2 objects on update/delete |
| `src/server/lib/env.ts` | **Modify** — add R2 env vars to Zod schema |
| `.env.example` | **Modify** — add R2 vars with comments |
| `src/shared/utils.ts` | **Modify** — add `productFullImageUrl()` helper |
| `src/client/components/products/ImageUploadField.tsx` | **Create** — upload widget |
| `src/client/components/products/ProductForm.tsx` | **Modify** — add `Controller` import, update `imageUrl` Zod type to `nullable().optional()`, replace text input with `<ImageUploadField>` wrapped in `<Controller>` |
| `src/client/components/products/ProductCard.tsx` | **Modify** — add `loading="lazy"` and `decoding="async"` to `<img>` |
| `src/client/routes/_auth/products/$productId.tsx` | **Modify** — render full-size image using `productFullImageUrl(product.imageUrl)` |

No database migration is required — `products.imagePath` already exists. The tRPC layer surfaces it as `imageUrl`.

---

## Why WebP + Two Sizes?

| Format/Size | ~Typical file size | Use case |
|---|---|---|
| Original JPEG (2 MP) | 1,200 KB | — never stored |
| JPEG resized to 400 px | 80–120 KB | poor caching |
| **WebP 400 px (card)** | **25–50 KB** | ProductCard grid/list |
| **WebP 1200 px (full)** | **60–100 KB** | product detail lightbox |

WebP achieves the same perceived quality as JPEG at roughly half the file size. Combined with Cloudflare's edge delivery and `Cache-Control: immutable`, card images load in under 100 ms even on mobile connections.

---

## Verification

1. Open a product and click the image upload area — file picker opens.
2. Select a JPEG or PNG over 5 MB — the upload completes; the preview appears immediately in the form.
3. Save the product — `products.imagePath` is populated with the R2 card URL.
4. Navigate to the Products list — the ProductCard shows the image in both grid and list modes.
5. Navigate to the product detail page — the full-size (1200 px) image is displayed.
6. Replace the image with a different file — the old R2 objects are deleted; only the new image appears.
7. Delete the product — both R2 objects are removed; no orphaned files remain.
8. Upload a non-image file (e.g., `.pdf`) — the server returns a 400 with a clear error message; no file is stored.
9. Upload a file over 10 MB — rejected with a clear error message.
10. Open DevTools → Network, filter by `image/webp` — all product images are WebP; response headers include `cache-control: public, max-age=31536000, immutable` and `cf-cache-status: HIT` on second load.

---

## Definition of Done

- [ ] `sharp` and `@aws-sdk/client-s3` installed
- [ ] R2 bucket created; env vars set in `.env` and `.env.example`
- [ ] `imageService.ts` processes uploads into card + full WebP variants and uploads to R2
- [ ] `POST /api/upload/product-image` endpoint live, auth-gated, error-handled
- [ ] Old R2 objects deleted when image is replaced or product deleted
- [ ] `ImageUploadField` component replaces text input in `ProductForm`
- [ ] `ProductCard` renders images with `loading="lazy"` and correct sizing in grid + list modes
- [ ] Product detail page renders full-size image
- [ ] `tsc --noEmit` passes clean
- [ ] Manual test: upload → card shows image → detail shows full image → replace → old files gone
