import { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { ArrowLeft, ArrowRight, CloudUpload, GripVertical, Trash, Images } from 'react-bootstrap-icons';
import { uploadArtifactFile } from '../utils/imageUpload';
import ArtifactModal from './ArtifactModal';
import type { ArtifactProps } from './Artifact';

interface SlideEntry {
    url: string;
    uploading?: boolean;
}

function parseSlidesContent(content: string): string[] | null {
    try {
        const parsed = JSON.parse(content);
        if (parsed?.slides && Array.isArray(parsed.slides)) {
            return parsed.slides.filter((s: unknown) => typeof s === 'string');
        }
    } catch { /* not JSON — legacy HTML */ }
    return null;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export interface ArtifactSlideshowEditorProps {
    exhibitId: number;
    content: string;
    onContentChange: (content: string) => void;
}

const TRANSPARENT_IMG = (() => {
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    return img;
})();

export function ArtifactSlideshowEditor({ exhibitId, content, onContentChange }: ArtifactSlideshowEditorProps) {
    const [slides, setSlides] = useState<SlideEntry[]>(() => {
        const urls = parseSlidesContent(content);
        return urls ? urls.map(url => ({ url })) : [];
    });
    const [dragActive, setDragActive] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const syncContent = useCallback((entries: SlideEntry[]) => {
        const urls = entries.filter(e => !e.uploading).map(e => e.url);
        onContentChange(urls.length ? JSON.stringify({ slides: urls }) : '');
    }, [onContentChange]);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const images = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (images.length === 0) return;

        const placeholders: SlideEntry[] = images.map(f => ({
            url: URL.createObjectURL(f),
            uploading: true,
        }));

        setSlides(prev => {
            const next = [...prev, ...placeholders];
            return next;
        });

        for (let i = 0; i < images.length; i++) {
            try {
                const url = await uploadArtifactFile(images[i], exhibitId);
                setSlides(prev => {
                    const idx = prev.indexOf(placeholders[i]);
                    if (idx === -1) return prev;
                    const next = [...prev];
                    URL.revokeObjectURL(placeholders[i].url);
                    next[idx] = { url };
                    syncContent(next);
                    return next;
                });
            } catch (err) {
                console.error('Failed to upload slide image:', err);
                setSlides(prev => {
                    const idx = prev.indexOf(placeholders[i]);
                    if (idx === -1) return prev;
                    URL.revokeObjectURL(placeholders[i].url);
                    const next = prev.filter((_, j) => j !== idx);
                    syncContent(next);
                    return next;
                });
            }
        }
    }, [exhibitId, syncContent]);

    const removeSlide = useCallback((index: number) => {
        setSlides(prev => {
            const next = prev.filter((_, i) => i !== index);
            syncContent(next);
            return next;
        });
    }, [syncContent]);

    const moveSlide = useCallback((from: number, to: number) => {
        if (from === to) return;
        setSlides(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            syncContent(next);
            return next;
        });
    }, [syncContent]);

    // --- File drop (for adding new images) ---
    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (dragIdx !== null) return;
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    }, [handleFiles, dragIdx]);

    const handleFileDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    }, []);

    // --- Reorder drag (vertical-only with drop indicator) ---
    const handleSlideDragStart = useCallback((e: React.DragEvent, idx: number) => {
        setDragIdx(idx);
        setDropTargetIdx(null);
        e.dataTransfer.setDragImage(TRANSPARENT_IMG, 0, 0);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleSlideDragOver = useCallback((e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (dragIdx === null) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const target = e.clientY < midY ? idx : idx + 1;
        if (target === dragIdx || target === dragIdx + 1) {
            setDropTargetIdx(null);
        } else {
            setDropTargetIdx(target);
        }
    }, [dragIdx]);

    const handleListDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const handleSlideDrop = useCallback(() => {
        if (dragIdx !== null && dropTargetIdx !== null) {
            const adjustedTarget = dropTargetIdx > dragIdx ? dropTargetIdx - 1 : dropTargetIdx;
            moveSlide(dragIdx, adjustedTarget);
        }
        setDragIdx(null);
        setDropTargetIdx(null);
    }, [dragIdx, dropTargetIdx, moveSlide]);

    const handleSlideDragEnd = useCallback(() => {
        setDragIdx(null);
        setDropTargetIdx(null);
    }, []);

    const uploading = slides.some(s => s.uploading);

    return (
        <Form.Group className="mb-3">
            <Form.Label>Slide Images *</Form.Label>

            {slides.length > 0 && (
                <div
                    className="slideshow-editor-list mb-3"
                    onDragOver={handleListDragOver}
                    onDrop={handleSlideDrop}
                >
                    {slides.map((slide, idx) => (
                        <div key={slide.url}>
                            {dropTargetIdx === idx && (
                                <div className="slideshow-editor-drop-indicator" />
                            )}
                            <div
                                className={`slideshow-editor-item${dragIdx === idx ? ' dragging' : ''}`}
                                draggable
                                onDragStart={(e) => handleSlideDragStart(e, idx)}
                                onDragOver={(e) => handleSlideDragOver(e, idx)}
                                onDragEnd={handleSlideDragEnd}
                            >
                                <GripVertical size={16} className="slideshow-editor-grip" />
                                <span className="slideshow-editor-number">{idx + 1}</span>
                                <img
                                    src={slide.url}
                                    alt={`Slide ${idx + 1}`}
                                    className="slideshow-editor-thumb"
                                />
                                {slide.uploading && (
                                    <div className="slideshow-editor-uploading">
                                        <Spinner size="sm" />
                                    </div>
                                )}
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 text-danger slideshow-editor-delete"
                                    onClick={() => removeSlide(idx)}
                                    disabled={slide.uploading}
                                >
                                    <Trash size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {dropTargetIdx === slides.length && (
                        <div className="slideshow-editor-drop-indicator" />
                    )}
                </div>
            )}

            <div
                className={`file-drop-zone p-4 text-center border rounded${dragActive ? ' border-primary bg-primary bg-opacity-10' : ''}`}
                onDragEnter={handleFileDrag}
                onDragLeave={handleFileDrag}
                onDragOver={handleFileDrag}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer', borderStyle: dragActive ? 'solid' : 'dashed' }}
            >
                {uploading ? (
                    <div className="d-flex align-items-center justify-content-center gap-2">
                        <Spinner size="sm" /><span>Uploading...</span>
                    </div>
                ) : (
                    <>
                        <CloudUpload size={40} className="text-muted mb-2" />
                        <p className="mb-1">
                            {slides.length > 0 ? 'Add more slides' : 'Drag and drop images here, or click to browse'}
                        </p>
                        <small className="text-muted">PNG, JPG, GIF, or WebP — select multiple to add in order</small>
                    </>
                )}
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
                style={{ display: 'none' }}
            />
        </Form.Group>
    );
}

// ---------------------------------------------------------------------------
// Slide Viewer (used inside the modal)
// ---------------------------------------------------------------------------

function SlideViewer({ slides }: { slides: string[] }) {
    const [current, setCurrent] = useState(0);
    const touchStartX = useRef(0);
    const total = slides.length;

    const prev = useCallback(() => setCurrent(i => Math.max(0, i - 1)), []);
    const next = useCallback(() => setCurrent(i => Math.min(total - 1, i + 1)), [total]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [prev, next]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    }, []);

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) {
            if (dx < 0) next();
            else prev();
        }
    }, [prev, next]);

    return (
        <div
            className="slide-viewer"
            onClick={e => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {current > 0 && (
                <button className="slide-viewer-arrow slide-viewer-arrow-left" onClick={prev} aria-label="Previous slide">
                    <ArrowLeft size={24} />
                </button>
            )}
            <img
                src={slides[current]}
                alt={`Slide ${current + 1} of ${total}`}
                className="slide-viewer-image"
                draggable={false}
            />
            {current < total - 1 && (
                <button className="slide-viewer-arrow slide-viewer-arrow-right" onClick={next} aria-label="Next slide">
                    <ArrowRight size={24} />
                </button>
            )}
            <div className="slide-viewer-counter">
                {current + 1} / {total}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Display Component
// ---------------------------------------------------------------------------

export default function ArtifactSlideshow({ artifact }: ArtifactProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const slides = parseSlidesContent(artifact.content);
    const isLegacy = slides === null;
    const firstSlide = slides?.[0] ?? null;

    const preview = artifact.description.length > 100
        ? artifact.description.substring(0, 100) + '...'
        : artifact.description;

    return (
        <>
            <div className="artifact-card artifact-slideshow" onClick={() => setModalOpen(true)}>
                <div className="artifact-shadow" />
                <div className="artifact-content">
                    <div className="artifact-preview artifact-slideshow-preview">
                        {firstSlide ? (
                            <img src={firstSlide} alt={artifact.title} className="artifact-image" />
                        ) : artifact.thumbnailUrl ? (
                            <img src={artifact.thumbnailUrl} alt={artifact.title} className="artifact-image" />
                        ) : (
                            <div className="artifact-slideshow-placeholder">
                                <Images size={48} className="text-muted" />
                            </div>
                        )}
                        <div className="artifact-badge-container">
                            <span className="artifact-badge">
                                {slides ? `${slides.length} Slide${slides.length !== 1 ? 's' : ''}` : 'Slideshow'}
                            </span>
                        </div>
                    </div>
                    <div className="artifact-meta">
                        <div className="artifact-header">
                            <span className="artifact-title">{artifact.title}</span>
                        </div>
                        <p className="artifact-text">{preview || 'View presentation...'}</p>
                        <div className="artifact-cta">Click to Open Archive</div>
                    </div>
                </div>
            </div>

            <ArtifactModal
                show={modalOpen}
                onClose={() => setModalOpen(false)}
                variant={isLegacy ? 'default' : 'video'}
                title={isLegacy ? artifact.title : undefined}
                description={isLegacy ? artifact.description : undefined}
            >
                {isLegacy ? (
                    <div
                        className="artifact-modal-slideshow"
                        dangerouslySetInnerHTML={{ __html: artifact.content }}
                    />
                ) : slides && slides.length > 0 ? (
                    <SlideViewer slides={slides} />
                ) : (
                    <p className="text-muted text-center py-4">No slides to display.</p>
                )}
            </ArtifactModal>
        </>
    );
}
