import { Modal, Button, Spinner } from 'react-bootstrap';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { Post } from './PostCard';
import EditorToolbar from './EditorToolbar';

interface PostEditorModalProps {
    show: boolean;
    activePost: Post | null;
    editor: Editor | null;
    isReady: boolean;
    isDirty?: boolean;
    isSaving?: boolean;
    onSave?: () => void;
    onClose: () => void;
    onUploadImage?: (file: File) => Promise<void>;
    /** When true, Save is disabled (e.g. new draft with empty body) */
    saveDisabled?: boolean;
}

function PostEditorModal({
    show,
    activePost,
    editor,
    isReady,
    isDirty,
    isSaving,
    onSave,
    onClose,
    onUploadImage,
    saveDisabled,
}: PostEditorModalProps) {

    return (
        <Modal show={show} onHide={onClose} size="lg">
            <Modal.Header closeButton={false}>
                <Modal.Title className="mb-0">
                    {activePost ? 'Edit Recognition Post' : 'Create Recognition Post'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {!isReady ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '350px' }}>
                        <Spinner animation="border" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </Spinner>
                    </div>
                ) : (
                    <div className="tiptap-editor-container">
                        <EditorToolbar editor={editor} onUploadImage={onUploadImage} />
                        <div className="tiptap-editor">
                            {editor && <EditorContent editor={editor} />}
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {isReady
                        ? (isSaving ? 'Saving...' : isDirty ? 'Unsaved changes' : 'Saved')
                        : '\u00a0'}
                </span>
                <div className="d-flex gap-2 ms-auto">
                    <Button
                        variant="outline-secondary"
                        onClick={onClose}
                        disabled={!!isSaving}
                    >
                        Cancel
                    </Button>
                    {isReady && onSave && (
                        <Button
                            variant="primary"
                            onClick={onSave}
                            disabled={saveDisabled ?? (!isDirty || !!isSaving)}
                        >
                            {isSaving ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-1" />
                                    Saving
                                </>
                            ) : 'Save'}
                        </Button>
                    )}
                </div>
            </Modal.Footer>
        </Modal>
    );
}

export default PostEditorModal;
