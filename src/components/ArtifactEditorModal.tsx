import { useState, useEffect } from 'react';
import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import { YjsRealtimeDatabaseProvider } from '../providers/YjsRealtimeDatabaseProvider';
import { parseGalleryContent, extractAllImages } from '../utils/artifactUtils';
import { ArtifactGalleryEditor } from './ArtifactGallery';
import { ArtifactSlideshowEditor } from './ArtifactSlideshow';
import { ArtifactDocumentEditor } from './ArtifactDocument';
import type { GalleryImageLayout } from '../utils/artifactUtils';
import type { Artifact } from './Artifact';

interface ArtifactEditorModalProps {
    show: boolean;
    exhibitId: number | null;
    artifact?: Artifact | null;
    onClose: () => void;
    onSaved?: () => void;
}

const ARTIFACT_TYPES: Array<{ value: Artifact['type']; label: string; description: string }> = [
    { value: 'video', label: 'Video', description: 'YouTube or Vimeo video' },
    { value: 'slideshow', label: 'Slideshow', description: 'Upload slide images' },
    { value: 'document', label: 'Document', description: 'Upload PDF or other documents' },
    { value: 'gallery', label: 'Gallery', description: 'Collection of images' },
];

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Generate YouTube embed HTML from video ID
 */
function generateYouTubeEmbed(videoId: string): string {
    return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
function getYouTubeThumbnail(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function ArtifactEditorModal({ show, exhibitId, artifact, onClose, onSaved }: ArtifactEditorModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [content, setContent] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [type, setType] = useState<Artifact['type']>('video');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Video-specific state
    const [videoUrl, setVideoUrl] = useState('');

    // Gallery-specific: images with layout
    const [galleryImages, setGalleryImages] = useState<GalleryImageLayout[]>([]);

    const isEditing = !!artifact;

    // Populate form when editing an existing artifact
    useEffect(() => {
        if (artifact) {
            setTitle(artifact.title);
            setDescription(artifact.description);
            setContent(artifact.content);
            setThumbnailUrl(artifact.thumbnailUrl || '');
            setType(artifact.type);
            // Try to extract video URL if it's a video with YouTube embed
            if (artifact.type === 'video') {
                const match = artifact.content.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    setVideoUrl(`https://www.youtube.com/watch?v=${match[1]}`);
                }
            }
            if (artifact.type === 'gallery') {
                const parsed = parseGalleryContent(artifact.content);
                if (parsed?.images?.length) {
                    setGalleryImages(parsed.images);
                } else {
                    const urls = extractAllImages(artifact.content);
                    const withLayout = urls.map((url, i) => {
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
                    setGalleryImages(withLayout);
                }
            }
        } else {
            // Reset form for new artifact
            setTitle('');
            setDescription('');
            setContent('');
            setThumbnailUrl('');
            setType('video');
            setVideoUrl('');
            setGalleryImages([]);
        }
    }, [artifact, show]);

    // Handle video URL changes - auto-generate embed code
    useEffect(() => {
        if (type === 'video' && videoUrl) {
            const videoId = extractYouTubeVideoId(videoUrl);
            if (videoId) {
                setContent(generateYouTubeEmbed(videoId));
                // Auto-set thumbnail if not already set
                if (!thumbnailUrl) {
                    setThumbnailUrl(getYouTubeThumbnail(videoId));
                }
            }
        }
    }, [videoUrl, type, thumbnailUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!exhibitId) return;
        if (type === 'gallery' && galleryImages.length === 0) return;

        setSaving(true);
        try {
            // Build artifact data, only including thumbnailUrl if it has a value
            const artifactData: {
                title: string;
                description: string;
                content: string;
                type: Artifact['type'];
                exhibitId: number;
                thumbnailUrl?: string;
            } = {
                title,
                description,
                content: type === 'gallery' ? JSON.stringify({ images: galleryImages }) : content,
                type,
                exhibitId,
            };

            // Only add thumbnailUrl if it's not empty (Firestore doesn't accept undefined)
            if (thumbnailUrl) {
                artifactData.thumbnailUrl = thumbnailUrl;
            }

            if (isEditing && artifact) {
                // Update existing artifact
                await YjsRealtimeDatabaseProvider.updateArtifact(artifact.id, artifactData);
            } else {
                // Create new artifact
                await YjsRealtimeDatabaseProvider.createArtifact(artifactData);
            }
            onSaved?.();
            onClose();
        } catch (error) {
            console.error('Failed to save artifact:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!artifact || !window.confirm('Are you sure you want to delete this artifact?')) return;

        setDeleting(true);
        try {
            await YjsRealtimeDatabaseProvider.deleteArtifact(artifact.id);
            onSaved?.();
            onClose();
        } catch (error) {
            console.error('Failed to delete artifact:', error);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Modal show={show} onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>
                    {isEditing ? 'Edit Artifact' : `Add Artifact to Exhibit ${exhibitId}`}
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label>Type *</Form.Label>
                        <Form.Select
                            value={type}
                            onChange={(e) => {
                                setType(e.target.value as Artifact['type']);
                                setContent('');
                                setVideoUrl('');
                                setGalleryImages([]);
                            }}
                        >
                            {ARTIFACT_TYPES.map(({ value, label, description }) => (
                                <option key={value} value={value}>{label} - {description}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Title *</Form.Label>
                        <Form.Control
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Leadership Keynote 2024"
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of the artifact"
                        />
                    </Form.Group>

                    {/* Video URL Input */}
                    {type === 'video' && (
                        <Form.Group className="mb-3">
                            <Form.Label>YouTube URL *</Form.Label>
                            <Form.Control
                                type="url"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                                required={!content}
                            />
                            <Form.Text className="text-muted">
                                Paste a YouTube video URL - embed code will be generated automatically
                            </Form.Text>
                            {content && (
                                <div className="mt-2 p-2 rounded" style={{ fontSize: '0.75rem' }}>
                                    <strong>Preview:</strong>
                                    <div className="mt-1" dangerouslySetInnerHTML={{ __html: content }} style={{ maxWidth: '280px' }} />
                                </div>
                            )}
                        </Form.Group>
                    )}

                    {type === 'video' && (
                        <Form.Group className="mb-3">
                            <Form.Label>Thumbnail URL (optional)</Form.Label>
                            <Form.Control
                                type="url"
                                value={thumbnailUrl}
                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                placeholder="https://example.com/thumbnail.jpg"
                            />
                            <Form.Text className="text-muted">
                                Leave empty to auto-detect from YouTube
                            </Form.Text>
                        </Form.Group>
                    )}

                    {type === 'slideshow' && exhibitId != null && (
                        <ArtifactSlideshowEditor
                            exhibitId={exhibitId}
                            content={content}
                            onContentChange={setContent}
                        />
                    )}

                    {type === 'gallery' && exhibitId != null && (
                        <ArtifactGalleryEditor
                            exhibitId={exhibitId}
                            images={galleryImages}
                            onImagesChange={setGalleryImages}
                        />
                    )}

                    {type === 'document' && exhibitId != null && (
                        <ArtifactDocumentEditor
                            exhibitId={exhibitId}
                            onContentChange={setContent}
                        />
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {isEditing && (
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            disabled={saving || deleting}
                            className="me-auto"
                        >
                            {deleting ? (
                                <>
                                    <Spinner size="sm" className="me-2" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose} disabled={saving || deleting}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={saving || deleting}>
                        {saving ? (
                            <>
                                <Spinner size="sm" className="me-2" />
                                Saving...
                            </>
                        ) : isEditing ? (
                            'Save Changes'
                        ) : (
                            'Create Artifact'
                        )}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default ArtifactEditorModal;
