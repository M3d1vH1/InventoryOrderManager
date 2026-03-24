export function productFullImageUrl(cardUrl: string): string {
    // Only transform R2-managed URLs that follow our naming convention.
    // Legacy/external URLs are returned unchanged — they don't have a separate full-size variant.
    if (cardUrl.includes("-card.webp")) {
        return cardUrl.replace("-card.webp", "-full.webp");
    }
    return cardUrl;
}
