import { useState, useEffect } from 'react';
import { PlayBtn } from 'react-bootstrap-icons';
import { getThumbnailUrl } from '../utils/artifactUtils';
import ArtifactModal from './ArtifactModal';
import type { ArtifactProps } from './Artifact';

export default function ArtifactVideo({ artifact }: ArtifactProps) {
    const thumbnailUrl = getThumbnailUrl(artifact);
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const preview = artifact.description.length > 150
        ? artifact.description.substring(0, 150) + '...'
        : artifact.description;

    useEffect(() => {
        if (!thumbnailUrl) return;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) {
                setAspectRatio(img.naturalWidth / img.naturalHeight);
            }
        };
        img.onerror = () => {
            if (!cancelled) setAspectRatio(null);
        };
        img.src = thumbnailUrl;
        return () => {
            cancelled = true;
            setAspectRatio(null);
        };
    }, [thumbnailUrl]);

    return (
        <>
        <div
            className="artifact-card artifact-video"
            onClick={() => setModalOpen(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="artifact-shadow" />
            <div
                className="artifact-content artifact-video-content"
                style={aspectRatio ? { aspectRatio } : undefined}
            >
                <div className="artifact-preview artifact-video-preview">
                    {thumbnailUrl && (
                        <img src={thumbnailUrl} alt={artifact.title} className="artifact-image" />
                    )}
                    <div className="artifact-overlay">
                        <div className="artifact-icon">
                            <PlayBtn size={32} />
                        </div>
                    </div>
                    <div className="artifact-badge-container">
                        <span className="artifact-badge">Video Exhibit</span>
                    </div>
                </div>
                <div
                    className="artifact-meta artifact-video-meta"
                    style={{
                        opacity: isHovered ? 1 : 0,
                        transform: isHovered ? 'translateY(0)' : 'translateY(16px)',
                        transition: 'opacity 0.35s ease, transform 0.35s ease',
                    }}
                >
                    <div className="artifact-header">
                        <span className="artifact-title">{artifact.title}</span>
                    </div>
                    <p className="artifact-text">{preview || 'View this exhibit...'}</p>
                    <div className="artifact-cta">Click to Open Archive</div>
                </div>
            </div>
        </div>

        <ArtifactModal
            show={modalOpen}
            onClose={() => setModalOpen(false)}
            variant="video"
        >
            <div
                className="artifact-modal-video-content"
                dangerouslySetInnerHTML={{ __html: artifact.content }}
            />
        </ArtifactModal>
        </>
    );
}
