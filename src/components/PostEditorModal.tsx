import { Modal, Spinner } from 'react-bootstrap';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { Post } from './PostCard';
import EditorToolbar from './EditorToolbar';

interface PostEditorModalProps {
    show: boolean;
    activePost: Post | null;
    editor: Editor | null;
    isReady: boolean;
    onClose: () => void;
    onUploadImage?: (file: File) => Promise<void>;
}

function PostEditorModal({ show, activePost, editor, isReady, onClose, onUploadImage }: PostEditorModalProps) {
    return (
        <Modal show={show} onHide={onClose} size="lg">
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
        </Modal>
    );
}

export default PostEditorModal;
