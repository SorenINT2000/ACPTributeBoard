import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Container, Card, Button, Spinner, Alert } from 'react-bootstrap';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { usePostEditor } from '../hooks/usePostEditor';
import {
    getPostsPaginated,
    getMorePosts,
    subscribeToNewestPost,
    deletePost as deletePostDocument,
} from '../hooks/postService';
import { getDisplayName } from '../utils/userProfile';
import type { Post } from '../components/PostCard';
import PostCard from '../components/PostCard';
import PostEditorModal from '../components/PostEditorModal';
import PostViewModal from '../components/PostViewModal';
import MasonryGrid from '../components/MasonryGrid';
import { Pencil, Trash } from 'react-bootstrap-icons';

const INITIAL_BATCH = 10;
const LOAD_MORE_BATCH = 5;

function Feed() {
    const { currentUser, userProfile } = useAuth();
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [isUnsavedDraft, setIsUnsavedDraft] = useState(false);
    const [viewPostId, setViewPostId] = useState<string | null>(null);
    const [pfpUrl, setPfpUrl] = useState<string | null>(null);
    const [pfpImageLoaded, setPfpImageLoaded] = useState(false);

    const displayName = getDisplayName(userProfile);

    useEffect(() => {
        getDownloadURL(ref(storage, 'website-images/moyer.jpg'))
            .then(setPfpUrl)
            .catch((err) => console.error('Failed to load moyer.jpg:', err));
    }, []);

    useEffect(() => {
        setPfpImageLoaded(false);
    }, [pfpUrl]);

    // --- Post feed state ---
    const [posts, setPosts] = useState<Post[]>([]);
    const [loadingState, setLoadingState] = useState<'loading-initial' | 'loading-more' | 'idle' | 'error'>('loading-initial');
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    /** True when Firestore's newest post id no longer matches ours (new post, deleted top post, etc.) */
    const [feedRefreshSuggested, setFeedRefreshSuggested] = useState(false);
    const newestKnownPostIdRef = useRef<string | null>(null);
    const oldestCreatedAtRef = useRef<number | null>(null);
    const isLoadingMoreRef = useRef(false);
    const refreshFeedHeadRef = useRef<() => Promise<void>>(async () => {});

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

    // When the newest document in Firestore changes, our paginated view may be stale (new post or top post removed)
    useEffect(() => {
        const unsubscribe = subscribeToNewestPost(post => {
            if (!post) return;
            if (newestKnownPostIdRef.current === null) return;
            if (newestKnownPostIdRef.current === post.id) return;
            setFeedRefreshSuggested(true);
        });
        return unsubscribe;
    }, []);

    const refreshFeedHead = useCallback(async () => {
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
            setFeedRefreshSuggested(false);
        } catch (err) {
            console.error('Failed to refresh feed:', err);
        }
    }, []);

    useEffect(() => {
        refreshFeedHeadRef.current = refreshFeedHead;
    }, [refreshFeedHead]);

    const handleDraftSaved = useCallback(() => {
        setIsUnsavedDraft(false);
        void refreshFeedHeadRef.current();
    }, []);

    const handleCloseEditor = useCallback(() => {
        setActivePostId(null);
        setIsUnsavedDraft(false);
    }, []);

    const handlePostSaved = useCallback(
        (detail: { postId: string; content: string }) => {
            const now = Date.now();
            setPosts(prev =>
                prev.map(p =>
                    p.id === detail.postId ? { ...p, content: detail.content, updatedAt: now } : p,
                ),
            );
            handleCloseEditor();
        },
        [handleCloseEditor],
    );

    const { editor, isReady, isDirty, isSaving, save, isEmpty, uploadImage } = usePostEditor({
        postId: activePostId,
        userId: currentUser?.uid ?? null,
        isUnsavedDraft,
        draftAuthor:
            isUnsavedDraft && currentUser
                ? {
                    email: currentUser.email,
                    authorName: displayName !== 'Anonymous' ? displayName : undefined,
                }
                : null,
        onDraftSaved: handleDraftSaved,
        onSaved: handlePostSaved,
    });

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
        setIsUnsavedDraft(true);
        setActivePostId(newPostId);
    };

    const handleEditPost = (postId: string) => {
        setIsUnsavedDraft(false);
        setActivePostId(postId);
    };
    const handleViewPost = (postId: string) => setViewPostId(postId);

    const handleDeletePost = useCallback(async (postId: string) => {
        try {
            await deletePostDocument(postId);
            setPosts(prev => {
                const next = prev.filter(p => p.id !== postId);
                if (newestKnownPostIdRef.current === postId) {
                    newestKnownPostIdRef.current = next.length > 0 ? next[0].id : null;
                }
                return next;
            });
            let closedEditor = false;
            setActivePostId(current => {
                if (current === postId) {
                    closedEditor = true;
                    return null;
                }
                return current;
            });
            if (closedEditor) setIsUnsavedDraft(false);
            setViewPostId(current => (current === postId ? null : current));
        } catch (err) {
            console.error('Failed to delete post:', err);
        }
    }, []);

    const handleCloseView = () => setViewPostId(null);

    const handleExhibitUpdated = useCallback((postId: string, exhibit: number | undefined) => {
        setPosts(prev =>
            prev.map(p => {
                if (p.id !== postId) return p;
                if (exhibit === undefined) {
                    const next = { ...p };
                    delete next.exhibit;
                    return next;
                }
                return { ...p, exhibit };
            }),
        );
    }, []);

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
        <Container className="mt-4 page-container">
            <Card className="feed-hero-card text-center mb-4">
                <Card.Body>
                    <div
                        className="mb-3 d-flex justify-content-center"
                        aria-busy={!pfpUrl || !pfpImageLoaded}
                    >
                        {/*
                          Show the skeleton until the image fires onLoad. If we only swap skeleton -> img when
                          pfpUrl is set, browsers often paint alt text for a moment before decode/display.
                        */}
                        <div
                            className="position-relative rounded-circle overflow-hidden bg-secondary bg-opacity-10"
                            style={{ width: 150, height: 150 }}
                        >
                            {pfpUrl ? (
                                <img
                                    src={pfpUrl}
                                    alt="Dr. Darilyn Moyer"
                                    width={150}
                                    height={150}
                                    onLoad={() => setPfpImageLoaded(true)}
                                    onError={() => setPfpImageLoaded(true)}
                                    className="position-relative d-block w-100 h-100 rounded-circle"
                                    style={{
                                        objectFit: 'cover',
                                        opacity: pfpImageLoaded ? 1 : 0,
                                    }}
                                />
                            ) : null}
                            {(!pfpUrl || !pfpImageLoaded) && (
                                <div
                                    className="placeholder placeholder-glow position-absolute top-0 start-0 w-100 h-100 rounded-circle m-0 border-0 bg-secondary"
                                    style={{ zIndex: 1 }}
                                    aria-hidden
                                />
                            )}
                        </div>
                    </div>
                    <Card.Title as="h1">Dr. Darilyn Moyer's Tribute Board</Card.Title>
                    <Card.Text>Welcome to her interactive tribute and recognition board!<br/>Please sign in and contribute your thoughts and memories.</Card.Text>
                    {currentUser ? (
                        <>
                            <div
                                className="feed-member-guide text-start mx-auto mb-4 p-3 rounded bg-body-secondary bg-opacity-25"
                                style={{ maxWidth: '36rem' }}
                            >
                                <ol className="small mb-0 ps-3">
                                    <li className="mb-2">
                                        Click <strong><span style={{ color: '#0d6efd' }}>Create a Post</span> below</strong> to compose a post.
                                    </li>
                                    <li className="mb-2">
                                        Write your message (bold/italic, emojis and images are supported).
                                    </li>
                                    <li className="mb-2">
                                        After you save, your post is visible to everyone else. Use (<Pencil color="#0d6efd" size={14} />) on your post to edit, or (<Trash color="#dc3545" size={14} />) to delete your post.
                                    </li>
                                    <li className="mb-2">
                                        If you have questions, please contact the staff at <a href="mailto:yourinquiries@tutamail.com">tlin3247@gmail.com</a>.
                                    </li>
                                </ol>
                            </div>
                            <Button variant="primary" onClick={handleCreateNew}>
                                Create a Post
                            </Button>
                        </>
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
                            <p className="text-muted small center mx-auto mt-4 mb-0" style={{ maxWidth: '36rem' }}>
                                You can read every post here without an account.<br/> Create a free account or sign in to
                                write your own message.
                            </p>
                        </div>
                    )}
                </Card.Body>
            </Card>

            <Container>
            {feedRefreshSuggested && (
                <div className="text-center mb-3">
                    <Button variant="outline-primary" size="sm" onClick={refreshFeedHead}>
                        Feed may have changed — tap to refresh
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
                                    onDelete={handleDeletePost}
                                    onExhibitUpdated={handleExhibitUpdated}
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
                saveDisabled={isSaving || !isDirty || (isUnsavedDraft && isEmpty())}
            />

            <PostViewModal
                show={viewPostId !== null}
                post={viewPost || null}
                onClose={handleCloseView}
            />
            </Container>
        </Container>
    );
}

export default Feed;
