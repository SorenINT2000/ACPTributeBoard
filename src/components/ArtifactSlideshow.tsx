import { useCallback, useRef, useState } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { CloudUpload, FileEarmark, FileEarmarkText, Trash } from 'react-bootstrap-icons';
import { uploadArtifactFile } from '../utils/imageUpload';
import { getThumbnailUrl } from '../utils/artifactUtils';
import ArtifactModal from './ArtifactModal';
import type { ArtifactProps } from './Artifact';

function extractGoogleSlidesId(url: string): string | null {
    const match = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/) ||
        url.match(/docs\.google\.com\/presentation\/e\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

function generateGoogleSlidesEmbed(presentationId: string): string {
    return `<iframe src="https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000" frameborder="0" width="960" height="569" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>`;
}

interface UploadedFile {
    name: string;
    url: string;
    type: string;
}

function getGoogleSlidesUrlFromEmbed(content: string): string | null {
    const match = content.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/) ||
        content.match(/docs\.google\.com\/presentation\/e\/([a-zA-Z0-9_-]+)/);
    return match ? `https://docs.google.com/presentation/d/${match[1]}` : null;
}

export interface ArtifactSlideshowEditorProps {
    exhibitId: number;
    content: string;
    onContentChange: (content: string) => void;
    /** When editing, pass existing content to prefill URL field */
    initialContent?: string;
}

export function ArtifactSlideshowEditor({ exhibitId, content, onContentChange, initialContent }: ArtifactSlideshowEditorProps) {
    const initialUrl = initialContent ? getGoogleSlidesUrlFromEmbed(initialContent) : null;
    const isFromUpload = initialContent && !initialUrl && (initialContent.includes('<iframe') || initialContent.includes('artifact-file-card'));
    const [slideshowUrl, setSlideshowUrl] = useState(initialUrl ?? '');
    const [inputMode, setInputMode] = useState<'url' | 'upload'>(initialUrl ? 'url' : isFromUpload ? 'upload' : 'url');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files).filter(f =>
            f.type === 'application/pdf' || f.name.toLowerCase().match(/\.(pdf|ppt|pptx)$/)
        );
        if (fileArray.length === 0) return;

        setUploading(true);
        try {
            const newFiles: UploadedFile[] = [];
            for (const file of fileArray) {
                const url = await uploadArtifactFile(file, exhibitId);
                newFiles.push({ name: file.name, url, type: file.type });
            }
            setUploadedFiles(prev => [...prev, ...newFiles]);
            const uploadedFile = newFiles[0];
            if (uploadedFile) {
                const file = fileArray[0]!;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const isOffice = file.type.includes('presentation') || file.name.toLowerCase().match(/\.(ppt|pptx)$/);
                if (isPdf) {
                    onContentChange(`<iframe src="${uploadedFile.url}" width="100%" height="600" title="${file.name}" style="border: none;"></iframe>`);
                } else if (isOffice) {
                    const encodedUrl = encodeURIComponent(uploadedFile.url);
                    onContentChange(`<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}" width="100%" height="600" title="${file.name}" frameborder="0"></iframe>`);
                } else {
                    onContentChange(`<div class="artifact-file-card"><div class="artifact-file-icon">📄</div><div class="artifact-file-info"><div class="artifact-file-name">${file.name}</div><div class="artifact-file-type">Presentation</div></div><a href="${uploadedFile.url}" target="_blank" rel="noopener noreferrer" class="artifact-file-button">Open File ↗</a></div>`);
                }
            }
        } catch (error) {
            console.error('Failed to upload slideshow:', error);
        } finally {
            setUploading(false);
        }
    }, [exhibitId, onContentChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.length) handleFileUpload(e.dataTransfer.files);
    }, [handleFileUpload]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    }, []);

    const removeFile = useCallback((index: number) => {
        setUploadedFiles(prev => {
            const next = prev.filter((_, i) => i !== index);
            if (next.length === 0) onContentChange('');
            return next;
        });
    }, [onContentChange]);

    // Sync content when URL changes
    const handleUrlChange = useCallback((url: string) => {
        setSlideshowUrl(url);
        const id = extractGoogleSlidesId(url);
        if (id) onContentChange(generateGoogleSlidesEmbed(id));
    }, [onContentChange]);

    return (
        <Form.Group className="mb-3">
            <Form.Label>Slideshow Source *</Form.Label>
            <div className="d-flex gap-2 mb-2">
                <Button variant={inputMode === 'url' ? 'primary' : 'outline-secondary'} size="sm"
                    onClick={() => { setInputMode('url'); setUploadedFiles([]); onContentChange(''); }}>
                    Google Slides URL
                </Button>
                <Button variant={inputMode === 'upload' ? 'primary' : 'outline-secondary'} size="sm"
                    onClick={() => { setInputMode('upload'); setSlideshowUrl(''); onContentChange(''); }}>
                    Upload File
                </Button>
            </div>

            {inputMode === 'url' ? (
                <>
                    <Form.Control type="url" value={slideshowUrl} onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://docs.google.com/presentation/d/..." required={!content} />
                    <Form.Text className="text-muted">Paste a Google Slides presentation URL</Form.Text>
                </>
            ) : (
                <>
                    <div className={`file-drop-zone p-4 text-center border rounded ${dragActive ? 'border-primary bg-primary bg-opacity-10' : 'border-dashed'}`}
                        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ cursor: 'pointer', borderStyle: dragActive ? 'solid' : 'dashed' }}>
                        {uploading ? (
                            <div className="d-flex align-items-center justify-content-center gap-2">
                                <Spinner size="sm" /><span>Uploading...</span>
                            </div>
                        ) : (
                            <>
                                <CloudUpload size={40} className="text-muted mb-2" />
                                <p className="mb-1">Drag and drop files here, or click to browse</p>
                                <small className="text-muted">PDF or PowerPoint files</small>
                            </>
                        )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx"
                        onChange={(e) => e.target.files?.length && handleFileUpload(e.target.files)} style={{ display: 'none' }} />
                    {uploadedFiles.length > 0 && (
                        <div className="mt-3">
                            <small className="text-muted d-block mb-2">Uploaded files:</small>
                            <div className="d-flex flex-wrap gap-2">
                                {uploadedFiles.map((file, index) => (
                                    <div key={index} className="d-flex align-items-center gap-2 p-2 rounded" style={{ fontSize: '0.875rem' }}>
                                        <FileEarmark size={24} className="text-muted" />
                                        <span className="text-truncate" style={{ maxWidth: 120 }}>{file.name}</span>
                                        <Button variant="link" size="sm" className="p-0 text-danger" onClick={(e) => { e.stopPropagation(); removeFile(index); }}>
                                            <Trash size={18} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </Form.Group>
    );
}

export default function ArtifactSlideshow({ artifact }: ArtifactProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const thumbnailUrl = getThumbnailUrl(artifact);
    const preview = artifact.description.length > 100
        ? artifact.description.substring(0, 100) + '...'
        : artifact.description;

    return (
        <>
        <div className="artifact-card artifact-slideshow" onClick={() => setModalOpen(true)}>
            <div className="artifact-shadow" />
            <div className="artifact-content">
                <div className="artifact-preview artifact-slideshow-preview">
                    {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={artifact.title} className="artifact-image" />
                    ) : (
                        <div className="artifact-slideshow-placeholder">
                            <FileEarmarkText size={48} className="text-muted" />
                        </div>
                    )}
                    <div className="artifact-badge-container">
                        <span className="artifact-badge">Slideshow</span>
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
            title={artifact.title}
            description={artifact.description}
        >
            <div
                className="artifact-modal-slideshow"
                dangerouslySetInnerHTML={{ __html: artifact.content }}
            />
        </ArtifactModal>
        </>
    );
}
