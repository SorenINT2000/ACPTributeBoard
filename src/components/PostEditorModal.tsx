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
}

function PostEditorModal({ show, activePost, editor, isReady, isDirty, isSaving, onSave, onClose, onUploadImage }: PostEditorModalProps) {
    const handleClose = () => {
        if (isDirty && onSave) {
            onSave();
        }
        onClose();
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>
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
            {isReady && onSave && (
                <Modal.Footer>
                    <span className="text-muted me-auto" style={{ fontSize: '0.8rem' }}>
                        {isSaving ? 'Saving...' : isDirty ? 'Unsaved changes' : 'Saved'}
                    </span>
                    <Button
                        variant="primary"
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Saving
                            </>
                        ) : 'Save'}
                    </Button>
                </Modal.Footer>
            )}
        </Modal>
    );
}

export default PostEditorModal;
