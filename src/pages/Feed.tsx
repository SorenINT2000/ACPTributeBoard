import { useState, useEffect, useRef } from 'react';
import { Container, Button, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { useYjs } from '../hooks/useYjs';
import { useSlidingWindow } from '../hooks/useSlidingWindow';
import { YjsRealtimeDatabaseProvider } from '../providers/YjsRealtimeDatabaseProvider';
import { getDisplayName } from '../utils/userProfile';
import PostCard from '../components/PostCard';
import PostEditorModal from '../components/PostEditorModal';
import PostViewModal from '../components/PostViewModal';
import MasonryGrid from '../components/MasonryGrid';
import DebugOverlay from '../components/DebugOverlay';

function Feed() {
    const { currentUser, userProfile } = useAuth();
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [viewPostId, setViewPostId] = useState<string | null>(null);

    // Get display name from profile or fall back to email
    const displayName = getDisplayName(userProfile);

    // Use the Yjs hook for collaborative editing
    const { editor, isReady, deletePost, isEmpty, uploadImage } = useYjs({
        postId: activePostId,
        userId: currentUser?.uid ?? null,
        userName: displayName,
    });

    // Use sliding window hook for paginated posts with real-time updates
    const { posts, loadingState, hasMore, error, getPostRef, sentinelRef, debugInfo } = useSlidingWindow({
        initialBatchSize: 10,
        loadMoreBatchSize: 5,
        disconnectThreshold: 3,
        intersectionRootMargin: '200px',
    });

    // Create new post
    const handleCreateNew = () => {
        if (!currentUser) return;

        const newPostId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        YjsRealtimeDatabaseProvider.createPost(
            newPostId,
            currentUser.uid,
            currentUser.email,
            displayName !== 'Anonymous' ? displayName : undefined
        ).then(() => {
            setActivePostId(newPostId);
        }).catch((error) => {
            console.error('Error creating post:', error);
        });
    };

    // Open modal for editing
    const handleEditPost = (postId: string) => {
        setActivePostId(postId);
    };

    // Open modal for viewing
    const handleViewPost = (postId: string) => {
        setViewPostId(postId);
    };

    // Close editor modal
    const handleCloseEditor = () => {
        // Delete post if empty
        if (activePostId && isEmpty()) {
            deletePost().catch((error) => {
                console.error('Error deleting empty post:', error);
            });
        }
        setActivePostId(null);
    };

    // Close view modal
    const handleCloseView = () => {
        setViewPostId(null);
    };

    const activePost = activePostId ? posts.find(p => p.id === activePostId) : null;
    const viewPost = viewPostId ? posts.find(p => p.id === viewPostId) : null;

    // Track previous posts to detect new ones for animation
    const previousPostIdsRef = useRef<Set<string>>(new Set());
    const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const currentPostIds = new Set(posts.map(p => p.id));
        const previousPostIds = previousPostIdsRef.current;

        // Find newly added posts
        const newlyAdded = new Set<string>();
        currentPostIds.forEach(id => {
            if (!previousPostIds.has(id)) {
                newlyAdded.add(id);
            }
        });

        // Update state with new post IDs asynchronously to avoid cascading renders
        if (newlyAdded.size > 0) {
            setTimeout(() => {
                setNewPostIds(newlyAdded);
                // Remove animation class after animation completes
                setTimeout(() => {
                    setNewPostIds(new Set());
                }, 500); // Match animation duration
            }, 0);
        }

        // Update previous post IDs
        previousPostIdsRef.current = currentPostIds;
    }, [posts]);

    // Transform posts to include contentLength for masonry estimation and animation class
    const masonryItems = posts.map(post => ({
        ...post,
        contentLength: post.content.length,
        isNew: newPostIds.has(post.id),
    }));

    return (
        <Container className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1>Recognition Feed</h1>
                    <p className="text-muted">Dynamic social feed with multimedia support</p>
                </div>
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCreateNew}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                    }}
                    aria-label="Create new post"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </Button>
            </div>

            {error && (
                <Alert variant="danger" className="mt-3">
                    <Alert.Heading>Error loading posts</Alert.Heading>
                    <p>{error.message}</p>
                </Alert>
            )}

            {loadingState === 'loading-initial' ? (
                <div className="text-center mt-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading posts...</span>
                    </Spinner>
                    <p className="text-muted mt-3">Loading posts...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center text-muted mt-5">
                    <p>No posts yet. Be the first to create a recognition post!</p>
                </div>
            ) : (
                <>
                    <MasonryGrid
                        items={masonryItems}
                        renderItem={(post, masonryRef) => {
                            // Combine MasonryGrid ref (for height measurement) with Intersection Observer ref
                            const combinedRef = (el: HTMLDivElement | null) => {
                                masonryRef(el);
                                getPostRef(post.id)(el);
                            };
                            return (
                                <div className={post.isNew ? 'post-card-new' : ''}>
                                    <PostCard
                                        post={post}
                                        onEdit={handleEditPost}
                                        onView={handleViewPost}
                                        cardRef={combinedRef}
                                    />
                                </div>
                            );
                        }}
                        sentinelRef={sentinelRef}
                        showSentinel={hasMore}
                    />
                    {loadingState === 'loading-more' && (
                        <div className="text-center mt-4">
                            <Spinner animation="border" size="sm" role="status">
                                <span className="visually-hidden">Loading more posts...</span>
                            </Spinner>
                        </div>
                    )}
                    {!hasMore && posts.length > 0 && (
                        <div className="text-center text-muted mt-4">
                            <p>You've reached the end of the feed.</p>
                        </div>
                    )}
                </>
            )}

            <PostEditorModal
                show={activePostId !== null}
                activePost={activePost || null}
                editor={editor}
                isReady={isReady}
                onClose={handleCloseEditor}
                onUploadImage={uploadImage}
            />

            <PostViewModal
                show={viewPostId !== null}
                post={viewPost || null}
                onClose={handleCloseView}
            />

            {/* Debug overlay for testing subscriptions */}
            <DebugOverlay debugInfo={debugInfo} posts={posts} />
        </Container>
    );
}

export default Feed;
