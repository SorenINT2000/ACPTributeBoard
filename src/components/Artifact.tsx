import ArtifactVideo from './ArtifactVideo';
import ArtifactGallery from './ArtifactGallery';
import ArtifactSlideshow from './ArtifactSlideshow';
import ArtifactDocument from './ArtifactDocument';

/**
 * Artifact type - represents curated exhibit content like videos, slide decks, etc.
 * Stored separately from regular posts in Firebase.
 */
export interface Artifact {
    id: string;
    title: string;
    description: string;
    /** HTML content - can include iframes, videos, images, etc. */
    content: string;
    /** Which exhibit this belongs to (1-8) */
    exhibitId: number;
    /** Optional thumbnail URL - if not provided, will try to extract from content */
    thumbnailUrl?: string;
    /** Type of artifact for display purposes */
    type: 'video' | 'slideshow' | 'document' | 'gallery';
    createdAt: number;
    updatedAt: number;
}

export interface ArtifactProps {
    artifact: Artifact;
}

/**
 * Artifact orchestrator: receives Firebase data and delegates rendering
 * to the appropriate type-specific component. Each component owns its own modal.
 */
export default function Artifact({ artifact }: ArtifactProps) {
    switch (artifact.type) {
        case 'video':
            return <ArtifactVideo artifact={artifact} />;
        case 'gallery':
            return <ArtifactGallery artifact={artifact} />;
        case 'slideshow':
            return <ArtifactSlideshow artifact={artifact} />;
        case 'document':
        default:
            return <ArtifactDocument artifact={artifact} />;
    }
}
