import { Modal } from 'react-bootstrap';
import type { Post } from './PostCard';

interface PostViewModalProps {
    show: boolean;
    post: Post | null;
    onClose: () => void;
}

function PostViewModal({ show, post, onClose }: PostViewModalProps) {
    if (!post) return null;

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Modal
            show={show}
            onHide={onClose}
            size="lg"
            centered
            className="post-view-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title className="d-flex flex-column">
                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                        {post.authorName || post.authorEmail}
                    </span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div
                    dangerouslySetInnerHTML={{ __html: post.content }}
                    className="post-content post-view-content"
                />
            </Modal.Body>
            <Modal.Footer className="justify-content-start border-top">
                <small className="text-muted">
                    Posted on {formatDate(post.createdAt)}
                </small>
            </Modal.Footer>
        </Modal>
    );
}

export default PostViewModal;
