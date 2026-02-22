import { useState, useRef, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { Trash } from 'react-bootstrap-icons';
import { GALLERY_TARGET_AREA, type GalleryImageLayout } from '../utils/artifactUtils';

/** Derive width/height in relative units from scale and aspect. */
function dimensionsFromScale(scale: number, aspect: number): { width: number; height: number } {
    const width = scale * Math.sqrt(GALLERY_TARGET_AREA * aspect);
    const height = scale * Math.sqrt(GALLERY_TARGET_AREA / aspect);
    return { width, height };
}

interface GalleryArrangementProps {
    images: GalleryImageLayout[];
    editable?: boolean;
    onLayoutChange: (images: GalleryImageLayout[]) => void;
    onRemoveImage?: (index: number) => void;
    onFilesDropped?: (files: FileList) => void;
    onImageClick?: (index: number, url: string) => void;
    uploading?: boolean;
    aspectRatio?: number;
}

export default function GalleryArrangement({
    images,
    editable = false,
    onLayoutChange,
    onRemoveImage,
    onFilesDropped,
    onImageClick,
    uploading = false,
    aspectRatio = 16 / 9,
}: GalleryArrangementProps) {
    const COMPACT_BREAKPOINT = 500;
    const containerRef = useRef<HTMLDivElement>(null);
    const containerSize = useRef({ width: 0, height: 0 });
    const [measured, setMeasured] = useState(false);
    const [compact, setCompact] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [dropActive, setDropActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!onFilesDropped) return;
        if (e.type === 'dragenter' || e.type === 'dragover') setDropActive(true);
        else if (e.type === 'dragleave') setDropActive(false);
    }, [onFilesDropped]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropActive(false);
        if (!onFilesDropped || !e.dataTransfer.files?.length) return;
        onFilesDropped(e.dataTransfer.files);
    }, [onFilesDropped]);

    const updateContainerSize = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        if (width === 0 || height === 0) return;

        containerSize.current = { width, height };
        setMeasured(true);
        setCompact(!editable && width < COMPACT_BREAKPOINT);
    }, [editable]);

    useEffect(() => {
        updateContainerSize();
        const ro = new ResizeObserver(updateContainerSize);
        const el = containerRef.current;
        if (el) ro.observe(el);
        return () => ro.disconnect();
    }, [updateContainerSize]);

    /** Uniform scale: 1 logical unit = k pixels for both x and y. Layout is square, centered in container. */
    const toPixels = useCallback(
        (rel: { x: number; y: number; width: number; height: number }) => {
            const { width: W, height: H } = containerSize.current;
            const k = Math.min(W, H);
            const offsetX = (W - k) / 2;
            const offsetY = (H - k) / 2;
            return {
                x: rel.x * k + offsetX,
                y: rel.y * k + offsetY,
                width: rel.width * k,
                height: rel.height * k,
            };
        },
        []
    );

    const toRelative = useCallback(
        (x: number, y: number, w: number, h: number) => {
            const { width: W, height: H } = containerSize.current;
            const k = Math.min(W, H);
            const offsetX = (W - k) / 2;
            const offsetY = (H - k) / 2;
            return {
                x: (x - offsetX) / k,
                y: (y - offsetY) / k,
                width: Math.max(0.01, w / k),
                height: Math.max(0.01, h / k),
            };
        },
        []
    );

    const handleImageLoad = (index: number, e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        if (!img.naturalWidth || !img.naturalHeight) return;
        const aspect = img.naturalWidth / img.naturalHeight;
        const next = images.map((i, j) =>
            j === index ? { ...i, scale: 1, aspect } : i
        );
        onLayoutChange(next);
    };

    const handleDragStop = (index: number, _e: unknown, d: { x: number; y: number }) => {
        if (!onLayoutChange) return;

        const img = images[index];
        const { width, height } = dimensionsFromScale(img.scale, img.aspect);
        const px = toPixels({ x: img.x, y: img.y, width, height });
        const rel = toRelative(d.x, d.y, px.width, px.height);
        const next = images.map((i, j) =>
            j === index ? { ...i, x: rel.x, y: rel.y } : i
        );
        onLayoutChange(next);
    };

    const handleResizeStop = (
        index: number,
        _e: unknown,
        _dir: string,
        ref: HTMLElement,
        _delta: { width: number; height: number },
        pos: { x: number; y: number }
    ) => {
        if (!onLayoutChange) return;

        const w = ref.offsetWidth;
        const h = ref.offsetHeight;
        const rel = toRelative(pos.x, pos.y, w, h);
        const area = rel.width * rel.height;
        const aspect = rel.width / rel.height;
        const scale = Math.sqrt(area / GALLERY_TARGET_AREA);
        const next = images.map((i, j) =>
            j === index ? { ...i, x: rel.x, y: rel.y, scale, aspect } : i
        );
        onLayoutChange(next);
    };

    const isEmpty = images.length === 0;
    const acceptDrops = editable && !!onFilesDropped;
    const readyToRender = isEmpty || measured;

    if (compact && !isEmpty) {
        return (
            <div ref={containerRef} className="gallery-arrangement-grid">
                {images.map((img, i) => (
                    <div
                        key={`${img.url}-${i}`}
                        className={`gallery-arrangement-grid-item ${onImageClick ? 'gallery-arrangement-image-clickable' : ''}`}
                        onClick={onImageClick ? () => onImageClick(i, img.url) : undefined}
                        role={onImageClick ? 'button' : undefined}
                        tabIndex={onImageClick ? 0 : undefined}
                        onKeyDown={onImageClick ? (e) => e.key === 'Enter' && onImageClick(i, img.url) : undefined}
                    >
                        <img
                            src={img.url}
                            alt=""
                            className="gallery-arrangement-image"
                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`gallery-arrangement ${isEmpty ? 'gallery-arrangement-empty' : ''} ${dropActive ? 'gallery-arrangement-drop-active' : ''}`}
            style={{ aspectRatio: String(aspectRatio) }}
            onClick={editable ? () => setSelectedIndex(null) : undefined}
            onDragEnter={acceptDrops ? handleDrag : undefined}
            onDragLeave={acceptDrops ? handleDrag : undefined}
            onDragOver={acceptDrops ? handleDrag : undefined}
            onDrop={acceptDrops ? handleDrop : undefined}
        >
            {uploading && (
                <div className="gallery-arrangement-uploading">
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Uploading...
                </div>
            )}
            {isEmpty ? (
                <div className="gallery-arrangement-empty-content">
                    <p className="mb-0 text-muted">Drop images here</p>
                </div>
            ) : !readyToRender ? (
                <div className="gallery-arrangement-empty-content">
                    <p className="mb-0 text-muted">Loading...</p>
                </div>
            ) : (
            <>
            {images.map((img, i) => {
                const { width, height } = dimensionsFromScale(img.scale, img.aspect);
                const px = toPixels({ x: img.x, y: img.y, width, height });
                const isSelected = editable && selectedIndex === i;

                if (editable) {
                    return (
                        <Rnd
                            key={`${img.url}-${i}`}
                            size={{ width: px.width, height: px.height }}
                            position={{ x: px.x, y: px.y }}
                            onDragStop={(_e, d) => handleDragStop(i, _e, d)}
                            onResizeStop={(_e, dir, ref, delta, pos) =>
                                handleResizeStop(i, _e, dir, ref, delta, pos)
                            }
                            bounds="parent"
                            lockAspectRatio={img.aspect}
                            disableDragging={!isSelected}
                            enableResizing={isSelected}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setSelectedIndex(i);
                            }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className={`gallery-arrangement-rnd ${isSelected ? 'selected' : ''}`}
                        >
                            <img
                                src={img.url}
                                alt=""
                                className="gallery-arrangement-image"
                                draggable={false}
                                onLoad={(e) => handleImageLoad(i, e)}
                                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            />
                            {isSelected && onRemoveImage && (
                                <button
                                    type="button"
                                    className="gallery-arrangement-remove"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveImage(i);
                                    }}
                                    aria-label="Remove image"
                                >
                                    <Trash size={16} />
                                </button>
                            )}
                        </Rnd>
                    );
                }

                return (
                    <div
                        key={`${img.url}-${i}`}
                        className={`gallery-arrangement-image-wrap ${onImageClick ? 'gallery-arrangement-image-clickable' : ''}`}
                        style={{
                            position: 'absolute',
                            left: px.x,
                            top: px.y,
                            width: px.width,
                            height: px.height,
                        }}
                        onClick={onImageClick ? () => onImageClick(i, img.url) : undefined}
                        role={onImageClick ? 'button' : undefined}
                        tabIndex={onImageClick ? 0 : undefined}
                        onKeyDown={onImageClick ? (e) => e.key === 'Enter' && onImageClick(i, img.url) : undefined}
                    >
                        <img
                            src={img.url}
                            alt=""
                            className="gallery-arrangement-image"
                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        />
                    </div>
                );
            })}
            </>
            )}
        </div>
    );
}
