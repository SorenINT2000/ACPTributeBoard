import { useMemo, useState, useEffect } from 'react';
import { Card, Button, Form } from 'react-bootstrap';
import { Pencil } from 'react-bootstrap-icons';
import { useAuth } from '../hooks/useAuth';
import { YjsRealtimeDatabaseProvider } from '../providers/YjsRealtimeDatabaseProvider';

interface Post {
    id: string;
    authorId: string;
    authorEmail: string;
    authorName?: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    exhibit?: number;
}

interface PostCardProps {
    post: Post;
    onEdit: (postId: string) => void;
    onView: (postId: string) => void;
    cardRef?: (el: HTMLDivElement | null) => void;
}

// Exhibit options (1-10)
const EXHIBIT_OPTIONS = [
    { value: '', label: 'No Exhibit' },
    { value: '1', label: 'Exhibit 1' },
    { value: '2', label: 'Exhibit 2' },
    { value: '3', label: 'Exhibit 3' },
    { value: '4', label: 'Exhibit 4' },
    { value: '5', label: 'Exhibit 5' },
    { value: '6', label: 'Exhibit 6' },
    { value: '7', label: 'Exhibit 7' },
    { value: '8', label: 'Exhibit 8' },
    { value: '9', label: 'Exhibit 9' },
    { value: '10', label: 'Exhibit 10' },
];

/**
 * Extract the first image src from HTML content
 */
function extractFirstImage(html: string): { imageSrc: string | null; contentWithoutImage: string } {
    // Match <img> tags and capture the src attribute
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
    const match = html.match(imgRegex);

    if (match) {
        const imageSrc = match[1];
        // Remove the first image from content
        const contentWithoutImage = html.replace(match[0], '');
        return { imageSrc, contentWithoutImage };
    }

    return { imageSrc: null, contentWithoutImage: html };
}

function PostCard({ post, onEdit, onView, cardRef }: PostCardProps) {
    const { currentUser, isHighLevel } = useAuth();

    const canEdit = !!currentUser && (currentUser.uid === post.authorId || isHighLevel);
    const exhibitLabel = EXHIBIT_OPTIONS.find(opt => opt.value === (post.exhibit?.toString() || ''))?.label ?? 'No Exhibit';
    const [isHovered, setIsHovered] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);

    const { imageSrc, contentWithoutImage } = useMemo(
        () => extractFirstImage(post.content),
        [post.content]
    );

    const hasImage = !!imageSrc;

    // Load image and calculate aspect ratio
    useEffect(() => {
        if (!imageSrc) {
            return;
        }

        // Reset aspect ratio when imageSrc changes
        let cancelled = false;

        const img = new Image();
        img.onload = () => {
            if (!cancelled) {
                // Calculate aspect ratio (width / height)
                const ratio = img.naturalWidth / img.naturalHeight;
                setAspectRatio(ratio);
            }
        };
        img.onerror = () => {
            if (!cancelled) {
                setAspectRatio(null);
            }
        };
        img.src = imageSrc;

        return () => {
            cancelled = true;
            setAspectRatio(null);
        };
    }, [imageSrc]);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleCardClick = () => {
        onView(post.id);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click from firing
        onEdit(post.id);
    };

    const handleExhibitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation(); // Prevent card click from firing
        const value = e.target.value;
        const exhibitNumber = value === '' ? null : parseInt(value, 10);
        YjsRealtimeDatabaseProvider.updatePostExhibit(post.id, exhibitNumber)
            .catch((error) => {
                console.error('Failed to update exhibit:', error);
            });
    };

    return (
        <div ref={cardRef}>
            <Card
                className={hasImage ? 'post-card-with-image' : ''}
                style={{
                    cursor: 'pointer',
                    ...(hasImage ? {
                        position: 'relative',
                        overflow: 'hidden',
                        // Use aspect-ratio if available, otherwise fall back to minHeight
                        ...(aspectRatio ? { aspectRatio: aspectRatio } : { minHeight: '280px' }),
                    } : {}),
                }}
                onClick={handleCardClick}
                onMouseEnter={() => hasImage && setIsHovered(true)}
                onMouseLeave={() => hasImage && setIsHovered(false)}
            >
                {hasImage && (
                    <div
                        className="post-card-bg post-card-old-style"
                        style={{
                            backgroundImage: `url(${imageSrc})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                        aria-hidden
                    />
                )}
                <Card.Body
                    className={hasImage ? 'd-flex flex-column justify-content-end' : ''}
                    style={hasImage ? {
                        opacity: isHovered ? 1 : 0,
                        transform: isHovered ? 'translateY(0)' : 'translateY(20px)',
                        transition: 'opacity 0.35s ease, transform 0.35s ease',
                    } : undefined}
                >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                        <Card.Subtitle className={`mb-0 ${hasImage ? 'text-white-50' : 'text-muted'}`}>
                            {post.authorName || post.authorEmail}
                        </Card.Subtitle>
                        {currentUser && (canEdit || isHighLevel) && (
                            <div className="d-flex gap-1 align-items-center" onClick={e => e.stopPropagation()}>
                                {isHighLevel ? (
                                    <Form.Select
                                        size="sm"
                                        value={post.exhibit?.toString() || ''}
                                        onChange={handleExhibitChange}
                                        aria-label="Select exhibit"
                                    >
                                        {EXHIBIT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </Form.Select>
                                ) : (
                                    <span className={`text-xs pr-2.5 ${hasImage ? 'text-white/50' : 'text-muted'}`}>
                                        {exhibitLabel}
                                    </span>
                                )}
                                {canEdit && (
                                    <Button
                                        variant={hasImage ? 'light' : 'link'}
                                        size="sm"
                                        onClick={handleEditClick}
                                        aria-label="Edit post"
                                        className="flex items-center justify-center px-2 py-2"
                                    >
                                        <Pencil size={14} />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                    <div
                        dangerouslySetInnerHTML={{ __html: contentWithoutImage }}
                        className={`post-content ${hasImage ? 'post-content-overlay' : ''}`}
                    />
                    <Card.Text
                        className={`mt-2 ${hasImage ? 'text-white-50' : 'text-muted'}`}
                        style={{ fontSize: '0.875rem' }}
                    >
                        {formatDate(post.createdAt)}
                    </Card.Text>
                </Card.Body>
            </Card>
        </div>
    );
}

export default PostCard;
export type { Post };

