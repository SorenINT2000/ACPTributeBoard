import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Spinner, OverlayTrigger, Popover } from 'react-bootstrap';
import { Trash, CloudUpload } from 'react-bootstrap-icons';
import {
    getExhibitImageEntries,
    uploadExhibitImage,
    deleteExhibitImage,
    type ExhibitImageEntry,
} from '../utils/exhibitImages';

interface CarouselEditorModalProps {
    show: boolean;
    exhibitNumber: number;
    onClose: () => void;
    onSaved: () => void;
}

interface LocalEntry extends ExhibitImageEntry {
    uploading?: boolean;
}

function CarouselEditorModal({ show, exhibitNumber, onClose, onSaved }: CarouselEditorModalProps) {
    const [entries, setEntries] = useState<LocalEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
        if (!show) return;
        setLoading(true);
        setDirty(false);
        getExhibitImageEntries(exhibitNumber)
            .then(setEntries)
            .catch(err => console.error('Failed to load carousel entries:', err))
            .finally(() => setLoading(false));
    }, [show, exhibitNumber]);

    const nextIndex = useCallback(() => {
        if (entries.length === 0) return 1;
        const maxPrefix = Math.max(
            ...entries.map(e => {
                const match = e.name.match(/^(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            }),
        );
        return maxPrefix + 1;
    }, [entries]);

    const handleUpload = useCallback(async (files: FileList | File[]) => {
        const images = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (images.length === 0) return;

        let idx = nextIndex();
        for (const file of images) {
            const placeholderName = `uploading-${Date.now()}-${Math.random()}`;
            const placeholder: LocalEntry = {
                name: placeholderName,
                url: URL.createObjectURL(file),
                uploading: true,
            };

            const currentIdx = idx++;
            setEntries(prev => [...prev, placeholder]);

            try {
                const entry = await uploadExhibitImage(file, exhibitNumber, currentIdx);
                setEntries(prev => {
                    const i = prev.findIndex(e => e.name === placeholderName);
                    if (i === -1) return prev;
                    URL.revokeObjectURL(prev[i].url);
                    const next = [...prev];
                    next[i] = entry;
                    return next;
                });
                setDirty(true);
            } catch (err) {
                console.error('Failed to upload carousel image:', err);
                setEntries(prev => {
                    const i = prev.findIndex(e => e.name === placeholderName);
                    if (i === -1) return prev;
                    URL.revokeObjectURL(prev[i].url);
                    return prev.filter((_, j) => j !== i);
                });
            }
        }
    }, [exhibitNumber, nextIndex]);

    const handleDelete = useCallback(async (entry: LocalEntry) => {
        if (entry.uploading) return;
        try {
            await deleteExhibitImage(exhibitNumber, entry.name);
            setEntries(prev => prev.filter(e => e.name !== entry.name));
            setDirty(true);
        } catch (err) {
            console.error('Failed to delete carousel image:', err);
        }
    }, [exhibitNumber]);

    const handleClose = () => {
        if (dirty) onSaved();
        onClose();
    };

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
    }, [handleUpload]);

    const handleFileDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    }, []);

    const uploading = entries.some(e => e.uploading);

    return (
        <Modal show={show} onHide={handleClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Edit Carousel — Exhibit {exhibitNumber}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" />
                        <p className="text-muted mt-2">Loading images...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <p className="text-muted text-center py-3">
                        No carousel images yet. Upload some below.
                    </p>
                ) : (
                    <div className="carousel-editor-list mb-3">
                        {entries.map((entry, idx) => (
                            <OverlayTrigger
                                key={entry.name}
                                placement="left"
                                delay={{ show: 300, hide: 0 }}
                                overlay={
                                    <Popover>
                                        <Popover.Body className="p-1">
                                            <img
                                                src={entry.url}
                                                alt={entry.name}
                                                className="carousel-editor-popover-img"
                                            />
                                        </Popover.Body>
                                    </Popover>
                                }
                            >
                                <div className="carousel-editor-item">
                                    <span className="carousel-editor-number">{idx + 1}</span>
                                    <span className="carousel-editor-name text-truncate">
                                        {entry.name}
                                    </span>
                                    {entry.uploading ? (
                                        <Spinner size="sm" className="ms-auto flex-shrink-0" />
                                    ) : (
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-0 text-danger ms-auto flex-shrink-0"
                                            onClick={() => handleDelete(entry)}
                                            aria-label="Delete image"
                                        >
                                            <Trash size={16} />
                                        </Button>
                                    )}
                                </div>
                            </OverlayTrigger>
                        ))}
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
                                {entries.length > 0
                                    ? 'Add more images'
                                    : 'Drag and drop images here, or click to browse'}
                            </p>
                            <small className="text-muted">
                                PNG, JPG, GIF, or WebP — images appear in upload order
                            </small>
                        </>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
                    style={{ display: 'none' }}
                />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default CarouselEditorModal;
