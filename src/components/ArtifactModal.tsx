import { Modal, type ModalProps } from 'react-bootstrap';

/** Bootstrap `Modal` options we expose (beyond `show` / close handler) */
type ArtifactModalBootstrapProps = Pick<
    ModalProps,
    | 'size'
    | 'centered'
    | 'backdrop'
    | 'scrollable'
    | 'keyboard'
    | 'fullscreen'
    | 'dialogClassName'
    | 'contentClassName'
    | 'backdropClassName'
    | 'enforceFocus'
    | 'restoreFocus'
    | 'container'
    | 'autoFocus'
>;

export interface ArtifactModalProps extends ArtifactModalBootstrapProps {
    show: boolean;
    /** Same as Bootstrap `onHide` — closes the modal */
    onClose: () => void;
    title?: string;
    description?: string;
    /** When `'video'`, borderless centered body for embeds (no header) */
    variant?: 'default' | 'video';
    children: React.ReactNode;
}

/**
 * Shared modal wrapper for artifact viewers (document, video, slideshow).
 * Uses react-bootstrap `Modal` (portal, backdrop, focus, a11y) with optional prop passthrough.
 */
export default function ArtifactModal({
    show,
    onClose,
    title = '',
    description = '',
    variant = 'default',
    children,
    size = 'lg',
    centered = true,
    backdrop = true,
    keyboard = true,
    scrollable = true,
    fullscreen,
    dialogClassName,
    contentClassName,
    backdropClassName,
    enforceFocus,
    restoreFocus,
    container,
    autoFocus,
}: ArtifactModalProps) {
    const isVideo = variant === 'video';

    /** Clicks on flex padding / letterboxing (inside modal, outside embed) should dismiss like the backdrop */
    const handleVideoBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.artifact-modal-video-inner')) {
            onClose();
        }
    };

    const mergedDialogClassName = [
        isVideo ? 'artifact-modal-dialog-video' : 'artifact-modal-dialog-default',
        dialogClassName,
    ]
        .filter(Boolean)
        .join(' ');

    const mergedContentClassName = [
        isVideo ? 'bg-transparent border-0 shadow-none' : 'artifact-modal-bs-content',
        contentClassName,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <Modal
            className="artifact-modal-bs"
            show={show}
            onHide={onClose}
            centered={centered}
            backdrop={backdrop}
            keyboard={keyboard}
            scrollable={!isVideo && scrollable}
            size={isVideo ? undefined : size}
            fullscreen={fullscreen}
            dialogClassName={mergedDialogClassName}
            contentClassName={mergedContentClassName}
            backdropClassName={['artifact-modal-bs-backdrop', backdropClassName].filter(Boolean).join(' ')}
            enforceFocus={enforceFocus}
            restoreFocus={restoreFocus}
            container={container}
            autoFocus={autoFocus}
        >
            {isVideo ? (
                <Modal.Body
                    className="artifact-modal-video-body d-flex justify-content-center align-items-center p-4"
                    onClick={handleVideoBodyClick}
                >
                    <div className="artifact-modal-video-inner">{children}</div>
                </Modal.Body>
            ) : (
                <>
                    <Modal.Header closeButton closeLabel="Close">
                        <Modal.Title
                            as="h2"
                            className={[
                                'artifact-modal-title mb-0 me-auto text-start w-100',
                                !title ? 'visually-hidden' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        >
                            {title || 'Artifact'}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="artifact-modal-bs-body pt-0">
                        {description ? (
                            <p className="artifact-modal-description mb-3">{description}</p>
                        ) : null}
                        <div className="artifact-modal-content">{children}</div>
                    </Modal.Body>
                </>
            )}
        </Modal>
    );
}
