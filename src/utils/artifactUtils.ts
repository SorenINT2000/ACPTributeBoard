export interface ArtifactForThumbnail {
    content: string;
    thumbnailUrl?: string;
}

/** Target area per image in relative units (0–1). scale=1 yields this area. */
export const GALLERY_TARGET_AREA = 0.06;

/**
 * Schema for gallery artifact content (JSON).
 * Uses scale × natural dimensions to fit target area; aspect preserves natural ratio.
 */
export interface GalleryImageLayout {
    url: string;
    x: number;
    y: number;
    /** Multiplier for natural dimensions. scale=1 gives target area. */
    scale: number;
    /** naturalWidth / naturalHeight. Used with scale to derive displayed size. */
    aspect: number;
}

/**
 * Normalize layout from legacy (width/height) to scale/aspect format.
 */
export function normalizeGalleryImage(layout: { url: string; x: number; y: number; width?: number; height?: number; scale?: number; aspect?: number }): GalleryImageLayout {
    if ('scale' in layout && typeof layout.scale === 'number' && 'aspect' in layout && typeof layout.aspect === 'number') {
        return { url: layout.url, x: layout.x, y: layout.y, scale: layout.scale, aspect: layout.aspect };
    }
    const w = layout.width ?? 0.18;
    const h = layout.height ?? 0.2;
    const area = w * h;
    const aspect = w / h;
    const scale = Math.sqrt(area / GALLERY_TARGET_AREA);
    return { url: layout.url, x: layout.x, y: layout.y, scale, aspect };
}

export interface GalleryContent {
    images: GalleryImageLayout[];
}

/**
 * Parse gallery content from artifact.content.
 * Returns parsed structure if valid JSON with images array, else null.
 * Normalizes legacy width/height format to scale/aspect.
 */
export function parseGalleryContent(content: string): GalleryContent | null {
    if (!content || typeof content !== 'string') return null;
    try {
        const parsed = JSON.parse(content) as unknown;
        if (parsed && typeof parsed === 'object' && Array.isArray((parsed as GalleryContent).images)) {
            const raw = parsed as { images: GalleryImageLayout[] };
            return {
                images: raw.images.map((img) => normalizeGalleryImage(img as Parameters<typeof normalizeGalleryImage>[0])),
            };
        }
    } catch {
        // Not valid JSON
    }
    return null;
}

/**
 * Extract YouTube video ID from URL or embed HTML
 */
export function extractYouTubeId(html: string): string | null {
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i,
        /youtu\.be\/([a-zA-Z0-9_-]+)/i,
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Extract the first image src from HTML content
 */
export function extractFirstImage(html: string): string | null {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
    const match = html.match(imgRegex);
    return match ? match[1] : null;
}

/**
 * Extract all image srcs from HTML content
 */
export function extractAllImages(html: string): string[] {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const urls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

/**
 * Get thumbnail URL for an artifact (explicit, YouTube, first image, or gallery first image)
 */
export function getThumbnailUrl(artifact: ArtifactForThumbnail): string | null {
    if (artifact.thumbnailUrl) return artifact.thumbnailUrl;
    const youtubeId = extractYouTubeId(artifact.content);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    const galleryContent = parseGalleryContent(artifact.content);
    if (galleryContent?.images?.length) return galleryContent.images[0].url;
    return extractFirstImage(artifact.content);
}
