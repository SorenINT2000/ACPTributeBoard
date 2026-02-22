import { createPortal } from 'react-dom';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { Button } from 'react-bootstrap';
import { Images } from 'react-bootstrap-icons';
import { parseGalleryContent, extractAllImages, type GalleryImageLayout } from '../utils/artifactUtils';
import { uploadArtifactFile, deleteStorageFileByUrl } from '../utils/imageUpload';
import GalleryArrangement from './GalleryArrangement';
import type { ArtifactProps } from './Artifact';

/** Single-image lightbox modal for gallery display (backdrop click to close, like video) */
function GalleryImageModal({ show, imageUrl, onClose }: { show: boolean; imageUrl: string | null; onClose: () => void }) {
    if (!show || !imageUrl) return null;
    const modal = (
        <div
            className="artifact-modal-backdrop"
            onClick={(e) => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
        >
            <img
                src={imageUrl}
                alt=""
                className="gallery-image-modal-img"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
    return createPortal(modal, document.body);
}

const GRID_COLS = 4;

export interface ArtifactGalleryEditorProps {
    exhibitId: number;
    images: GalleryImageLayout[];
    onImagesChange: (images: GalleryImageLayout[]) => void;
}

export function ArtifactGalleryEditor({ exhibitId, images, onImagesChange }: ArtifactGalleryEditorProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (fileArray.length === 0) return;

        setUploading(true);
        try {
            const existingUrls = new Set(images.map(g => g.url));
            const newImages: GalleryImageLayout[] = [...images];

            for (const file of fileArray) {
                const url = await uploadArtifactFile(file, exhibitId);
                if (existingUrls.has(url)) continue;
                existingUrls.add(url);
                const idx = newImages.length;
                const col = idx % GRID_COLS;
                const row = Math.floor(idx / GRID_COLS);
                newImages.push({
                    url,
                    x: 0.02 + col * 0.24,
                    y: 0.02 + row * 0.28,
                    scale: 1,
                    aspect: 1,
                });
            }

            onImagesChange(newImages);
        } catch (error) {
            console.error('Failed to upload images:', error);
        } finally {
            setUploading(false);
        }
    }, [exhibitId, images, onImagesChange]);

    const handleLayoutChange = useCallback((next: GalleryImageLayout[]) => {
        onImagesChange(next);
    }, [onImagesChange]);

    const handleRemoveImage = useCallback((index: number) => {
        const urlToDelete = images[index]?.url;
        if (urlToDelete) {
            deleteStorageFileByUrl(urlToDelete).catch((err) =>
                console.warn('Failed to delete image from storage:', err)
            );
        }
        const next = images.filter((_, i) => i !== index);
        onImagesChange(next);
    }, [images, onImagesChange]);

    return (
        <Form.Group className="mb-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
                <Form.Label className="mb-0">Gallery</Form.Label>
                <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    Insert Image
                </Button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files?.length && handleFileUpload(e.target.files)}
                style={{ display: 'none' }}
            />
            <GalleryArrangement
                images={images}
                editable
                onLayoutChange={handleLayoutChange}
                onRemoveImage={handleRemoveImage}
                onFilesDropped={(files) => handleFileUpload(files)}
                uploading={uploading}
            />
        </Form.Group>
    );
}

function imagesToDisplay(artifact: ArtifactProps['artifact']): GalleryImageLayout[] {
    const parsed = parseGalleryContent(artifact.content);
    if (parsed?.images?.length) {
        return parsed.images;
    }
    const urls = extractAllImages(artifact.content);
    return urls.map((url, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return {
            url,
            x: 0.02 + col * 0.24,
            y: 0.02 + row * 0.28,
            scale: 1,
            aspect: 1,
        };
    });
}

export default function ArtifactGallery({ artifact }: ArtifactProps) {
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const images = useMemo(() => imagesToDisplay(artifact), [artifact.content]);

    if (images.length === 0) {
        return (
            <div className="artifact-gallery-empty">
                <div className="artifact-gallery-placeholder">
                    <Images size={48} className="text-muted" />
                </div>
                <p className="text-muted mb-0">{artifact.title}</p>
            </div>
        );
    }

    return (
        <>
        <div className="artifact-gallery-inline">
            {(artifact.title || artifact.description) && (
                <div className="artifact-gallery-header">
                    {artifact.title && <h3 className="artifact-gallery-title">{artifact.title}</h3>}
                    {artifact.description && <p className="artifact-gallery-description">{artifact.description}</p>}
                </div>
            )}
            <GalleryArrangement
                images={images}
                editable={false}
                onLayoutChange={() => {}}
                onImageClick={(_, url) => setSelectedImageUrl(url)}
            />
        </div>

        <GalleryImageModal
            show={selectedImageUrl !== null}
            imageUrl={selectedImageUrl}
            onClose={() => setSelectedImageUrl(null)}
        />
        </>
    );
}
