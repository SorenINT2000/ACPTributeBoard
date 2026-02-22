import { createPortal } from 'react-dom';

interface ArtifactModalProps {
    show: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    /** When 'video', hides title/description and uses video-specific sizing */
    variant?: 'default' | 'video';
    children: React.ReactNode;
}

/**
 * Shared modal wrapper for artifact view modals.
 * Renders via Portal to document.body so it appears above all content
 * (including sticky parallax headers from later exhibits).
 */
export default function ArtifactModal({ show, onClose, title = '', description = '', variant = 'default', children }: ArtifactModalProps) {
    if (!show) return null;

    const isVideo = variant === 'video';

    const modal = isVideo ? (
        <div
            className="artifact-modal-backdrop"
            onClick={e => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
        >
            {children}
        </div>
    ) : (
        <div className="artifact-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="artifact-modal" onClick={e => e.stopPropagation()}>
                <button
                    type="button"
                    className="artifact-modal-close"
                    onClick={onClose}
                    aria-label="Close"
                >
                    ×
                </button>
                {title && <h2 className="artifact-modal-title">{title}</h2>}
                {description && <p className="artifact-modal-description">{description}</p>}
                <div className="artifact-modal-content">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
