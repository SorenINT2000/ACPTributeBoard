import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Container, Card, Button, Spinner, Alert } from 'react-bootstrap';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { usePostEditor } from '../hooks/usePostEditor';
import { createPost, getPostsPaginated, getMorePosts, subscribeToNewestPost } from '../hooks/postService';
import { getDisplayName } from '../utils/userProfile';
import type { Post } from '../components/PostCard';
import PostCard from '../components/PostCard';
import PostEditorModal from '../components/PostEditorModal';
import PostViewModal from '../components/PostViewModal';
import MasonryGrid from '../components/MasonryGrid';

const INITIAL_BATCH = 10;
const LOAD_MORE_BATCH = 5;

function Feed() {
    const { currentUser, userProfile } = useAuth();
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [viewPostId, setViewPostId] = useState<string | null>(null);
    const [pfpUrl, setPfpUrl] = useState<string | null>(null);

    const displayName = getDisplayName(userProfile);

    useEffect(() => {
        getDownloadURL(ref(storage, 'website-images/moyer.jpg'))
            .then(setPfpUrl)
            .catch((err) => console.error('Failed to load moyer.jpg:', err));
    }, []);

    const { editor, isReady, isDirty, isSaving, save, deletePost, isEmpty, uploadImage } = usePostEditor({
        postId: activePostId,
        userId: currentUser?.uid ?? null,
    });

    // --- Post feed state ---
    const [posts, setPosts] = useState<Post[]>([]);
    const [loadingState, setLoadingState] = useState<'loading-initial' | 'loading-more' | 'idle' | 'error'>('loading-initial');
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [hasNewPosts, setHasNewPosts] = useState(false);
    const newestKnownPostIdRef = useRef<string | null>(null);
    const oldestCreatedAtRef = useRef<number | null>(null);
    const isLoadingMoreRef = useRef(false);

    // Initial fetch
    useEffect(() => {
        getPostsPaginated(INITIAL_BATCH + 1)
            .then(fetched => {
                const hasMorePosts = fetched.length > INITIAL_BATCH;
                const batch = fetched.slice(0, INITIAL_BATCH);

                if (batch.length > 0) newestKnownPostIdRef.current = batch[0].id;
                const oldest = batch.length > 0 ? Math.min(...batch.map(p => p.createdAt)) : null;

                setPosts(batch);
                oldestCreatedAtRef.current = oldest;
                setHasMore(hasMorePosts);
                setLoadingState('idle');
            })
            .catch(err => {
                setError(err instanceof Error ? err : new Error('Failed to load posts'));
                setLoadingState('error');
            });
    }, []);

    // New-posts banner listener
    useEffect(() => {
        const unsubscribe = subscribeToNewestPost(post => {
            if (!post) return;
            if (newestKnownPostIdRef.current === null) return;
            if (newestKnownPostIdRef.current === post.id) return;
            setHasNewPosts(true);
        });
        return unsubscribe;
    }, []);

    const loadNewPosts = useCallback(async () => {
        try {
            const fresh = await getPostsPaginated(INITIAL_BATCH + 1);
            const hasMorePosts = fresh.length > INITIAL_BATCH;
            const batch = fresh.slice(0, INITIAL_BATCH);

            if (batch.length > 0) newestKnownPostIdRef.current = batch[0].id;

            setPosts(prev => {
                const merged = new Map(prev.map(p => [p.id, p]));
                batch.forEach(p => merged.set(p.id, p));
                return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
            });

            const allCreatedAts = batch.map(p => p.createdAt);
            if (allCreatedAts.length > 0) {
                const freshOldest = Math.min(...allCreatedAts);
                if (oldestCreatedAtRef.current === null || freshOldest < oldestCreatedAtRef.current) {
                    oldestCreatedAtRef.current = freshOldest;
                }
            }

            setHasMore(prev => prev || hasMorePosts);
            setHasNewPosts(false);
        } catch (err) {
            console.error('Failed to load new posts:', err);
        }
    }, []);

    const loadMorePosts = useCallback(async () => {
        if (isLoadingMoreRef.current || !hasMore || oldestCreatedAtRef.current === null) return;
        isLoadingMoreRef.current = true;
        setLoadingState('loading-more');

        try {
            const fetched = await getMorePosts(oldestCreatedAtRef.current, LOAD_MORE_BATCH + 1);
            if (fetched.length === 0) {
                setHasMore(false);
                setLoadingState('idle');
                isLoadingMoreRef.current = false;
                return;
            }

            const hasMorePosts = fetched.length > LOAD_MORE_BATCH;
            const batch = hasMorePosts ? fetched.slice(0, LOAD_MORE_BATCH) : fetched;

            const oldest = Math.min(...batch.map(p => p.createdAt));
            oldestCreatedAtRef.current = oldest;

            setPosts(prev => [...prev, ...batch]);
            setHasMore(hasMorePosts);
            setLoadingState('idle');
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load more posts'));
            setLoadingState('error');
        } finally {
            isLoadingMoreRef.current = false;
        }
    }, [hasMore]);

    // Stable ref so the IntersectionObserver callback always calls the latest loadMorePosts
    const loadMoreRef = useRef(loadMorePosts);
    useEffect(() => { loadMoreRef.current = loadMorePosts; }, [loadMorePosts]);

    // Sentinel intersection observer for infinite scroll
    const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
    const sentinelRef = useCallback((el: HTMLDivElement | null) => {
        if (typeof IntersectionObserver === 'undefined') return;
        if (sentinelObserverRef.current) {
            sentinelObserverRef.current.disconnect();
            sentinelObserverRef.current = null;
        }
        if (el) {
            const observer = new IntersectionObserver(
                entries => {
                    if (entries[0]?.isIntersecting) loadMoreRef.current();
                },
                { rootMargin: '200px', threshold: 0.1 },
            );
            observer.observe(el);
            sentinelObserverRef.current = observer;
        }
    }, []);

    // --- Post actions ---
    const handleCreateNew = () => {
        if (!currentUser) return;
        const newPostId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        createPost(
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

    const handleEditPost = (postId: string) => setActivePostId(postId);
    const handleViewPost = (postId: string) => setViewPostId(postId);

    const handleCloseEditor = () => {
        if (activePostId && isEmpty()) {
            deletePost().catch((error) => {
                console.error('Error deleting empty post:', error);
            });
        }
        setActivePostId(null);
    };

    const handleCloseView = () => setViewPostId(null);

    const activePost = activePostId ? posts.find(p => p.id === activePostId) : null;
    const viewPost = viewPostId ? posts.find(p => p.id === viewPostId) : null;

    // --- New-post animation tracking ---
    const previousPostIdsRef = useRef<Set<string>>(new Set());
    const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const currentPostIds = new Set(posts.map(p => p.id));
        const previousPostIds = previousPostIdsRef.current;

        const newlyAdded = new Set<string>();
        currentPostIds.forEach(id => {
            if (!previousPostIds.has(id)) newlyAdded.add(id);
        });

        if (newlyAdded.size > 0) {
            setTimeout(() => {
                setNewPostIds(newlyAdded);
                setTimeout(() => setNewPostIds(new Set()), 500);
            }, 0);
        }

        previousPostIdsRef.current = currentPostIds;
    }, [posts]);

    const masonryItems = posts.map(post => ({
        ...post,
        contentLength: post.content.length,
        isNew: newPostIds.has(post.id),
    }));

    return (
        <Container className="mt-4">
            <Card className="text-center mb-4">
                <Card.Body>
                    <div className="mb-3">
                        {pfpUrl ? (
                            <img
                                src={pfpUrl}
                                alt="Soren"
                                style={{
                                    width: 150,
                                    height: 150,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                }}
                            />
                        ) : (
                            <Spinner animation="border" variant="secondary" />
                        )}
                    </div>
                    <Card.Title as="h1">Dr. Moyer's Tribute Board</Card.Title>
                    <Card.Text>Welcome to the interactive tribute and recognition board!</Card.Text>
                    {currentUser ? (
                        <Button variant="primary" onClick={handleCreateNew}>
                            Create a Post
                        </Button>
                    ) : (
                        <div>
                            <Card.Text>Sign in to create a recognition post</Card.Text>
                            <div className="d-flex gap-2 justify-content-center mt-2">
                                <Link to="/login">
                                    <Button variant="primary">Sign In</Button>
                                </Link>
                                <Link to="/signup">
                                    <Button variant="outline-primary">Sign Up</Button>
                                </Link>
                            </div>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {hasNewPosts && (
                <div className="text-center mb-3">
                    <Button variant="outline-primary" size="sm" onClick={loadNewPosts}>
                        New posts available — tap to refresh
                    </Button>
                </div>
            )}

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
                        renderItem={(post, masonryRef) => (
                            <div className={post.isNew ? 'post-card-new' : ''}>
                                <PostCard
                                    post={post}
                                    onEdit={handleEditPost}
                                    onView={handleViewPost}
                                    cardRef={masonryRef}
                                />
                            </div>
                        )}
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
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={save}
                onClose={handleCloseEditor}
                onUploadImage={uploadImage}
            />

            <PostViewModal
                show={viewPostId !== null}
                post={viewPost || null}
                onClose={handleCloseView}
            />
        </Container>
    );
}

export default Feed;
