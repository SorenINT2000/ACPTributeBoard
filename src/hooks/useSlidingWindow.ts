import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { YjsRealtimeDatabaseProvider } from '../providers/YjsRealtimeDatabaseProvider';
import type { Post } from '../components/PostCard';

interface UseSlidingWindowOptions {
    initialBatchSize?: number;
    loadMoreBatchSize?: number;
    disconnectThreshold?: number;
    intersectionRootMargin?: string;
}

interface DebugInfo {
    activeSubscriptions: string[];
    visiblePostIds: string[];
    totalLoadedPosts: number;
}

interface UseSlidingWindowResult {
    posts: Post[];
    loadingState: 'idle' | 'loading-initial' | 'loading-more' | 'error';
    hasMore: boolean;
    error: Error | null;
    getPostRef: (postId: string) => (el: HTMLDivElement | null) => void;
    sentinelRef: (el: HTMLDivElement | null) => void;
    debugInfo: DebugInfo;
}

const DEFAULT_OPTIONS: Required<UseSlidingWindowOptions> = {
    initialBatchSize: 10,
    loadMoreBatchSize: 5,
    disconnectThreshold: 3,
    intersectionRootMargin: '200px',
};

/**
 * Custom hook for managing a sliding window of posts with real-time updates
 * Only maintains Firebase connections for visible posts (with buffer)
 */
export function useSlidingWindow(options: UseSlidingWindowOptions = {}): UseSlidingWindowResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // State
    const [loadedPosts, setLoadedPosts] = useState<Map<string, Post>>(new Map());
    const [loadingState, setLoadingState] = useState<'idle' | 'loading-initial' | 'loading-more' | 'error'>('loading-initial');
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [visibilityChangeTrigger, setVisibilityChangeTrigger] = useState(0);
    const [debugInfo, setDebugInfo] = useState<DebugInfo>({
        activeSubscriptions: [],
        visiblePostIds: [],
        totalLoadedPosts: 0,
    });

    // Refs
    const activeListeners = useRef<Map<string, () => void>>(new Map());
    const visiblePostIds = useRef<Set<string>>(new Set());
    const oldestCreatedAt = useRef<number | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
    const postElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const isLoadingMoreRef = useRef(false);
    const loadMoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Capture initial configuration - won't change after mount
    const initialBatchSizeRef = useRef(opts.initialBatchSize);
    const loadMoreBatchSizeRef = useRef(opts.loadMoreBatchSize);
    const disconnectThresholdRef = useRef(opts.disconnectThreshold);
    const intersectionRootMarginRef = useRef(opts.intersectionRootMargin);

    // Transform loaded posts map to sorted array (newest first)
    const posts = useMemo(() => {
        return Array.from(loadedPosts.values()).sort((a, b) => b.createdAt - a.createdAt);
    }, [loadedPosts]);

    // Refs for Intersection Observer to avoid recreating observer on every update
    const postsRef = useRef<Post[]>(posts);
    const hasMoreRef = useRef(hasMore);
    const loadMorePostsRef = useRef<(() => Promise<void>) | null>(null);

    // Keep refs current
    useEffect(() => {
        postsRef.current = posts;
    }, [posts]);
    useEffect(() => {
        hasMoreRef.current = hasMore;
    }, [hasMore]);

    // Track subscription changes with a counter to trigger debug updates
    const [subscriptionChangeCounter, setSubscriptionChangeCounter] = useState(0);

    // Sync debug info whenever relevant data changes
    useEffect(() => {
        setDebugInfo({
            activeSubscriptions: Array.from(activeListeners.current.keys()),
            visiblePostIds: Array.from(visiblePostIds.current),
            totalLoadedPosts: loadedPosts.size,
        });
    }, [loadedPosts.size, subscriptionChangeCounter, visibilityChangeTrigger]);

    // Helper to unsubscribe from a post
    const unsubscribeFromPost = useCallback((postId: string) => {
        const unsubscribe = activeListeners.current.get(postId);
        if (unsubscribe) {
            unsubscribe();
            activeListeners.current.delete(postId);
            setSubscriptionChangeCounter(c => c + 1);
        }
    }, []);

    // Subscribe to a post for real-time updates
    const subscribeToPost = useCallback((postId: string) => {
        // Don't subscribe if already subscribed
        if (activeListeners.current.has(postId)) {
            return;
        }

        const unsubscribe = YjsRealtimeDatabaseProvider.subscribeToPost(postId, (post) => {
            if (post === null) {
                // Post was deleted
                setLoadedPosts((prev) => {
                    const next = new Map(prev);
                    next.delete(postId);
                    return next;
                });
                // Unsubscribe
                unsubscribeFromPost(postId);
            } else {
                // Post was updated
                setLoadedPosts((prev) => {
                    const next = new Map(prev);
                    next.set(postId, post);
                    return next;
                });
            }
        });

        activeListeners.current.set(postId, unsubscribe);
        setSubscriptionChangeCounter(c => c + 1);
    }, [unsubscribeFromPost]);

    // Load initial batch of posts (runs once on mount)
    useEffect(() => {
        // Capture initial batch size to prevent memory leaks if option changes
        const batchSize = initialBatchSizeRef.current;

        // Request one more than needed to determine if more posts exist
        const unsubscribe = YjsRealtimeDatabaseProvider.subscribeToPostsPaginated(batchSize + 1, (postsArray) => {
            // If we got more than we asked for, there are more posts
            const hasMorePosts = postsArray.length > batchSize;

            const postsMap = new Map<string, Post>();
            let oldest: number | null = null;

            postsArray.slice(0, batchSize).forEach(post => {
                postsMap.set(post.id, post);
                subscribeToPost(post.id);
                oldest = oldest === null ? post.createdAt : Math.min(oldest, post.createdAt);
            });

            setLoadedPosts(postsMap);
            oldestCreatedAt.current = oldest;
            setHasMore(hasMorePosts);
            setLoadingState('idle');
            setError(null);
        });

        return () => unsubscribe();
    }, [subscribeToPost]);

    // Load more posts when scrolling near bottom (with debouncing)
    const loadMorePosts = useCallback(async () => {
        if (isLoadingMoreRef.current || !hasMore || oldestCreatedAt.current === null) {
            return;
        }

        // Debounce rapid calls
        if (loadMoreTimeoutRef.current) {
            clearTimeout(loadMoreTimeoutRef.current);
        }

        loadMoreTimeoutRef.current = setTimeout(async () => {
            if (isLoadingMoreRef.current || !hasMore || oldestCreatedAt.current === null) {
                return;
            }

            isLoadingMoreRef.current = true;
            setLoadingState('loading-more');

            try {
                const batchSize = loadMoreBatchSizeRef.current;

                // Request one more than needed to determine if more posts exist
                const postsArray = await YjsRealtimeDatabaseProvider.loadMorePostsOnce(
                    oldestCreatedAt.current,
                    batchSize + 1
                );

                if (postsArray.length === 0) {
                    setHasMore(false);
                    setLoadingState('idle');
                    isLoadingMoreRef.current = false;
                    return;
                }

                // If we got more than we asked for, there are more posts
                const hasMorePosts = postsArray.length > batchSize;

                // Only use the first N posts
                const postsToUse = hasMorePosts
                    ? postsArray.slice(0, batchSize)
                    : postsArray;

                setLoadedPosts((prev) => {
                    const next = new Map(prev);
                    let oldest: number | null = oldestCreatedAt.current;

                    postsToUse.forEach((post) => {
                        next.set(post.id, post);
                        subscribeToPost(post.id);
                        if (oldest === null || post.createdAt < oldest) {
                            oldest = post.createdAt;
                        }
                    });

                    oldestCreatedAt.current = oldest;
                    return next;
                });

                setHasMore(hasMorePosts);
                setLoadingState('idle');
                isLoadingMoreRef.current = false;
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to load more posts'));
                setLoadingState('error');
                isLoadingMoreRef.current = false;
            }
        }, 300); // 300ms debounce
    }, [hasMore, subscribeToPost]);

    // Update loadMorePostsRef when loadMorePosts changes
    useEffect(() => {
        loadMorePostsRef.current = loadMorePosts;
    }, [loadMorePosts]);

    // Set up Intersection Observer for visibility tracking
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') {
            return;
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const postId = entry.target.getAttribute('data-post-id');
                    if (!postId) return;

                    if (entry.isIntersecting) {
                        visiblePostIds.current.add(postId);
                        subscribeToPost(postId);
                    } else {
                        visiblePostIds.current.delete(postId);
                        // Don't unsubscribe immediately - wait for threshold
                    }
                });

                // Trigger cleanup when visibility changes (also triggers debug info update)
                setVisibilityChangeTrigger((prev) => prev + 1);
            },
            {
                rootMargin: intersectionRootMarginRef.current,
                threshold: 0.1,
            }
        );

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [subscribeToPost]);

    // Sentinel callback ref - attaches observer when element mounts
    const sentinelCallbackRef = useCallback(
        (el: HTMLDivElement | null) => {
            if (typeof IntersectionObserver === 'undefined') {
                return;
            }

            // Disconnect existing observer if it exists
            if (sentinelObserverRef.current) {
                sentinelObserverRef.current.disconnect();
                sentinelObserverRef.current = null;
            }

            if (el && hasMoreRef.current) {
                // Create new observer with current rootMargin
                sentinelObserverRef.current = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                const currentHasMore = hasMoreRef.current;
                                const loadMore = loadMorePostsRef.current;
                                if (currentHasMore && loadMore) {
                                    loadMore();
                                }
                            }
                        });
                    },
                    {
                        rootMargin: intersectionRootMarginRef.current,
                        threshold: 0.1,
                    }
                );

                sentinelObserverRef.current.observe(el);
            }
        },
        [] // Empty deps - rootMargin captured in ref
    );

    // Cleanup: Unsubscribe from posts that are far from viewport (triggered by visibility changes)
    useEffect(() => {
        // Debounce cleanup to avoid running on every tiny visibility change
        const timeout = setTimeout(() => {
            const visibleIds = Array.from(visiblePostIds.current);
            const disconnectThreshold = disconnectThresholdRef.current * loadMoreBatchSizeRef.current;
            const currentPosts = postsRef.current;

            activeListeners.current.forEach((_unsubscribe, postId) => {
                const postIndex = currentPosts.findIndex((p) => p.id === postId);
                if (postIndex === -1) return;

                // Check if post is far from any visible post
                let shouldDisconnect = true;
                for (const visibleId of visibleIds) {
                    const visibleIndex = currentPosts.findIndex((p) => p.id === visibleId);
                    if (visibleIndex !== -1 && Math.abs(postIndex - visibleIndex) < disconnectThreshold) {
                        shouldDisconnect = false;
                        break;
                    }
                }

                if (shouldDisconnect && !visibleIds.includes(postId)) {
                    unsubscribeFromPost(postId);
                }
            });
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeout);
    }, [visibilityChangeTrigger, unsubscribeFromPost]);

    // Get ref callback for PostCard
    const getPostRef = useCallback(
        (postId: string) => {
            return (el: HTMLDivElement | null) => {
                if (el) {
                    el.setAttribute('data-post-id', postId);
                    postElementRefs.current.set(postId, el);
                    if (observerRef.current) {
                        observerRef.current.observe(el);
                    }
                } else {
                    postElementRefs.current.delete(postId);
                }
            };
        },
        []
    );

    // Note: New posts will be detected through individual post subscriptions
    // when they enter the visible window. For posts created at the top,
    // they will be picked up when the user scrolls to top or refreshes.
    // A more sophisticated approach could add a listener for newest posts,
    // but that's beyond the scope of the initial implementation.

    // Cleanup all listeners on unmount
    useEffect(() => {
        // Capture refs to avoid stale closure warnings
        const listeners = activeListeners.current;
        const observer = observerRef.current;
        const sentinelObserver = sentinelObserverRef.current;
        const loadMoreTimeout = loadMoreTimeoutRef.current;

        return () => {
            if (loadMoreTimeout) {
                clearTimeout(loadMoreTimeout);
            }
            listeners.forEach((unsubscribe) => unsubscribe());
            listeners.clear();
            if (observer) {
                observer.disconnect();
            }
            if (sentinelObserver) {
                sentinelObserver.disconnect();
            }
        };
    }, []);

    return {
        posts,
        loadingState,
        hasMore,
        error,
        getPostRef,
        sentinelRef: sentinelCallbackRef,
        debugInfo,
    };
}
