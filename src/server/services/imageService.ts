import sharp from "sharp";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { env } from "../lib/env.js";
import crypto from "crypto";

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
