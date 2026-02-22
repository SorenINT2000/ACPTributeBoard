import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { ref, set, update, remove, onChildAdded, onValue, onDisconnect, push, query, orderByKey, orderByChild, limitToLast, endAt, get, type Unsubscribe } from 'firebase/database';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query as firestoreQuery, orderBy, type Unsubscribe as FirestoreUnsubscribe } from 'firebase/firestore';
import { database, firestore } from '../firebaseConfig';
import { fromUint8Array, toUint8Array } from 'js-base64';

/**
 * Custom Yjs provider that syncs Y.Doc state and awareness (cursor positions) with Firebase Realtime Database
 * 
 * Architecture:
 * - Document History: Stored as a list of Base64 strings at `posts/{docId}/updates`
 * - Awareness/Cursors: Stored as JSON objects at `awareness/{docId}/{clientId}` (using Yjs clientID)
 */
export class YjsRealtimeDatabaseProvider {
    private ydoc: Y.Doc;
    private rtdbPath: string;
    private userId: string;
    private unsubscribe: Unsubscribe | null = null;
    private awarenessUnsubscribe: Unsubscribe | null = null;
    private awareness: Awareness;
    private awarenessPath: string;
    private selfAwarenessRef: ReturnType<typeof ref>;
    private awarenessUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    private isEditorFocused: boolean = false;
    private updatesRef: ReturnType<typeof ref>;

    constructor(ydoc: Y.Doc, path: string, userId: string, docId: string) {
        this.ydoc = ydoc;
        this.rtdbPath = path;
        this.userId = userId;
        this.awarenessPath = `awareness/${docId}`;

        // Use Yjs clientID for awareness storage (native Yjs approach)
        this.selfAwarenessRef = ref(database, `${this.awarenessPath}/${this.ydoc.clientID}`);
        this.updatesRef = ref(database, `${this.rtdbPath}/updates`);

        // Create awareness instance
        this.awareness = new Awareness(ydoc);

        this.connect();

        // Create basic awareness entry (without cursor) after connecting
        // Use setTimeout to ensure it happens after any cleanup from previous provider
        setTimeout(() => {
            this.createBasicAwarenessEntry();
        }, 0);
    }

    /**
     * Create a basic awareness entry without cursor fields
     * This indicates the user has the modal open but cursor is not in editor
     */
    private createBasicAwarenessEntry() {
        set(this.selfAwarenessRef, {
            userId: this.userId,
            updatedAt: Date.now(),
        }).catch((error) => {
            console.error('Error creating basic awareness entry:', error);
        });
    }

    /**
     * Set whether the editor is focused
     * When false, cursor fields will be removed from awareness
     */
    public setEditorFocused(focused: boolean) {
        const wasFocused = this.isEditorFocused;
        this.isEditorFocused = focused;

        if (!focused && wasFocused) {
            // Only remove cursor fields if we were previously focused
            // This prevents interference when setting initial state
            const currentState = this.awareness.getLocalState();
            if (currentState && typeof currentState === 'object') {
                // Clear cursor-related fields from awareness
                const stateWithoutCursor = { ...currentState } as Record<string, unknown>;
                delete stateWithoutCursor.cursor;

                // Update awareness to remove cursor
                this.awareness.setLocalState(stateWithoutCursor);

                // Write basic entry without cursor to RTDB
                set(this.selfAwarenessRef, {
                    userId: this.userId,
                    updatedAt: Date.now(),
                }).catch((error) => {
                    console.error('Error updating awareness on blur:', error);
                });
            } else if (!currentState) {
                // No state exists, ensure basic entry exists
                this.createBasicAwarenessEntry();
            }
        }
    }

    private connect() {
        this.connectDocumentSync();
        this.connectAwarenessSync();
    }

    // ==================================================================
    // DOCUMENT SYNC (The "Truth")
    // ==================================================================

    private connectDocumentSync() {
        // A. Listen for remote updates from Firebase (Incoming)
        // Use orderByKey() to ensure updates are applied in chronological order
        // (Firebase push keys are designed to sort chronologically)
        const orderedUpdatesQuery = query(this.updatesRef, orderByKey());
        this.unsubscribe = onChildAdded(orderedUpdatesQuery, (snapshot) => {
            const base64Update = snapshot.val();
            if (typeof base64Update !== 'string') return;

            try {
                const binaryUpdate = toUint8Array(base64Update);
                // Apply update to local Doc.
                // We pass 'this' as the origin to identify that this update came from Firebase.
                Y.applyUpdate(this.ydoc, binaryUpdate, this);
            } catch (e) {
                console.error('[RTDB-Yjs] Failed to apply update', e);
            }
        });

        // B. Listen for local updates from User (Outgoing)
        this.ydoc.on('update', this.onLocalDocUpdate);
    }

    /**
     * Handles local edits and pushes them to Firebase.
     */
    private onLocalDocUpdate = (update: Uint8Array, origin: unknown) => {
        // CRITICAL: If the update originated from this provider (received from Firebase),
        // do NOT send it back to Firebase. This prevents infinite loops.
        if (origin === this) return;

        // Convert binary to Base64 for RTDB storage
        const base64String = fromUint8Array(update);

        // Push to the list
        push(this.updatesRef, base64String).catch(err => {
            console.error('[RTDB-Yjs] Failed to push update', err);
        });
    };

    // ==================================================================
    // AWARENESS SYNC (The "Cursors")
    // ==================================================================

    private connectAwarenessSync() {
        const awareness = this.awareness;

        // A. Handle Disconnects
        // If the user loses internet or closes tab, remove their cursor from DB automatically
        onDisconnect(this.selfAwarenessRef).remove().catch((error) => {
            console.error('Error setting up disconnect handler:', error);
        });

        // B. Listen for local awareness changes (Cursor moves, Selection)
        awareness.on('update', this.onLocalAwarenessUpdate);

        // C. Listen for remote awareness changes (Other users)
        const allAwarenessRef = ref(database, this.awarenessPath);
        this.awarenessUnsubscribe = onValue(allAwarenessRef, (snapshot) => {
            if (!snapshot.exists()) return;

            const data = snapshot.val() || {};

            // We map the raw JSON back into the Yjs Awareness map
            const remoteStates: Record<number, Record<string, unknown>> = {};

            Object.keys(data).forEach(clientIdStr => {
                const clientId = parseInt(clientIdStr, 10);

                // Skip our own data (we rely on local state for that)
                if (clientId === this.ydoc.clientID) return;

                if (data[clientIdStr] && typeof data[clientIdStr] === 'object') {
                    // Remove metadata fields before applying to awareness
                    const state = data[clientIdStr] as Record<string, unknown>;
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { userId, updatedAt, ...awarenessState } = state;
                    remoteStates[clientId] = awarenessState;
                }
            });

            // Apply these states to the local Awareness instance.
            // We essentially tell Yjs: "Here is the state of everyone else."
            // Track which clients were added, updated, or removed for event emission
            const added: number[] = [];
            const updated: number[] = [];
            const removed: number[] = [];

            // First, remove clients that are no longer present
            awareness.getStates().forEach((_, clientId) => {
                if (clientId !== this.ydoc.clientID && !remoteStates[clientId]) {
                    // User left? Remove them.
                    awareness.states.delete(clientId);
                    removed.push(clientId);
                }
            });

            // Then, set/update remote states
            Object.entries(remoteStates).forEach(([clientIdStr, state]) => {
                const clientId = parseInt(clientIdStr, 10);
                const existingState = awareness.states.get(clientId);
                if (!existingState) {
                    added.push(clientId);
                } else {
                    updated.push(clientId);
                }
                awareness.states.set(clientId, state);
            });

            // Emit awareness change event so TipTap's CollaborationCaret can react
            if (added.length > 0 || updated.length > 0 || removed.length > 0) {
                awareness.emit('change', [{ added, updated, removed }, 'remote']);
            }
        }, (error) => {
            console.error('Error listening to awareness updates:', error);
        });
    }

    /**
     * Pushes local awareness state (cursor pos, name, color) to Firebase
     */
    private onLocalAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        // Only act if *our* state changed (or we were added)
        const changed = added.concat(updated).concat(removed);
        if (!changed.includes(this.ydoc.clientID)) return;

        // Debounce awareness writes
        if (this.awarenessUpdateTimeout) {
            clearTimeout(this.awarenessUpdateTimeout);
        }

        this.awarenessUpdateTimeout = setTimeout(() => {
            const localState = this.awareness.getLocalState();

            if (localState) {
                // We are active
                // Only write cursor fields if editor is focused
                if (this.isEditorFocused) {
                    // Editor is focused - include cursor data
                    set(this.selfAwarenessRef, {
                        ...localState,
                        userId: this.userId,
                        updatedAt: Date.now(),
                    }).catch((error) => {
                        console.error('Error updating awareness in RTDB:', error);
                    });
                } else {
                    // Editor not focused - write basic entry without cursor
                    set(this.selfAwarenessRef, {
                        userId: this.userId,
                        updatedAt: Date.now(),
                    }).catch((error) => {
                        console.error('Error updating awareness in RTDB:', error);
                    });
                }
            } else {
                // We are inactive or destroying, remove our key
                remove(this.selfAwarenessRef).catch(() => { });
            }
        }, 100); // 100ms debounce
    };

    public disconnect() {
        // Disconnect document sync - just call the unsubscribe function directly
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        // Remove Yjs internal listeners
        this.ydoc.off('update', this.onLocalDocUpdate);

        // Disconnect awareness sync
        if (this.awarenessUpdateTimeout) {
            clearTimeout(this.awarenessUpdateTimeout);
            this.awarenessUpdateTimeout = null;
        }

        // Remove Yjs internal listeners
        this.awareness.off('update', this.onLocalAwarenessUpdate);

        // Remove our cursor from RTDB immediately, then check if we should compact
        remove(this.selfAwarenessRef)
            .then(() => this.compactUpdatesIfLastUser())
            .catch(() => { });

        // Clear local awareness state to prevent any further updates
        try {
            this.awareness.setLocalState(null);
        } catch {
            // Ignore errors - awareness might already be cleared
        }

        // Disconnect awareness listener - just call the unsubscribe function directly
        if (this.awarenessUnsubscribe) {
            this.awarenessUnsubscribe();
            this.awarenessUnsubscribe = null;
        }

        // Cancel the onDisconnect handler (since we handled it manually above)
        onDisconnect(this.selfAwarenessRef).cancel().catch(() => {
            // Ignore errors - handler might already be cancelled
        });
    }

    /**
     * Compact the updates field if this is the last user viewing the post.
     * This replaces all incremental updates with a single snapshot of the full document state.
     */
    private async compactUpdatesIfLastUser(): Promise<void> {
        try {
            // Check if there are any other users viewing this post
            const awarenessRef = ref(database, this.awarenessPath);
            const awarenessSnapshot = await get(awarenessRef);

            // If there are still other users, don't compact
            if (awarenessSnapshot.exists() && Object.keys(awarenessSnapshot.val()).length > 0) {
                return;
            }

            // Check if updates exist and need compaction
            const updatesSnapshot = await get(this.updatesRef);
            if (!updatesSnapshot.exists()) {
                return;
            }

            const updates = updatesSnapshot.val();
            const updateCount = Object.keys(updates).length;

            // Only compact if there are multiple updates (no point compacting a single update)
            if (updateCount <= 1) {
                return;
            }

            // Encode the full document state as a single update
            const fullState = Y.encodeStateAsUpdate(this.ydoc);
            const base64State = fromUint8Array(fullState);

            // Replace all updates with the single compacted state
            await set(this.updatesRef, {
                compacted: base64State,
            });
        } catch (error) {
            // Silently fail - compaction is an optimization, not critical
            console.warn('Failed to compact updates:', error);
        }
    }

    public getAwareness() {
        return this.awareness;
    }

    /**
     * Update the post content in Realtime Database
     * This is separate from Yjs document sync and is used for feed display
     */
    public updatePostContent(content: string): Promise<void> {
        if (!this.rtdbPath) {
            return Promise.reject(new Error('Not connected to a document'));
        }
        const postRef = ref(database, this.rtdbPath);
        return update(postRef, {
            content,
            updatedAt: Date.now(),
        });
    }

    /**
     * Delete the post from Realtime Database
     */
    public deletePost(): Promise<void> {
        if (!this.rtdbPath) {
            return Promise.reject(new Error('Not connected to a document'));
        }
        const postRef = ref(database, this.rtdbPath);
        return remove(postRef);
    }

    public destroy() {
        this.disconnect();
    }

    // Static methods for post management operations that don't require a provider instance

    /**
     * Update a post's exhibit assignment
     * @param postId - The ID of the post to update
     * @param exhibitNumber - The exhibit number (1-10) or null to remove from all exhibits
     */
    static updatePostExhibit(postId: string, exhibitNumber: number | null): Promise<void> {
        const postRef = ref(database, `posts/${postId}`);
        return update(postRef, {
            exhibit: exhibitNumber,
            updatedAt: Date.now(),
        });
    }

    /**
     * Subscribe to the posts list in Realtime Database
     */
    static subscribeToPosts(callback: (posts: Array<{ id: string; authorId: string; authorEmail: string; authorName?: string; content: string; createdAt: number; updatedAt: number; exhibit?: number }>) => void): () => void {
        const postsRef = ref(database, 'posts');
        const unsubscribe = onValue(postsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const postsArray = Object.entries(data).map(([id, post]) => {
                    const postData = post as Record<string, unknown>;
                    return {
                        id,
                        authorId: postData.authorId as string,
                        authorEmail: postData.authorEmail as string,
                        authorName: postData.authorName as string | undefined,
                        content: (postData.content as string) || '',
                        createdAt: postData.createdAt as number,
                        updatedAt: postData.updatedAt as number,
                        exhibit: postData.exhibit as number | undefined,
                    };
                });
                // Sort by createdAt descending (newest first)
                postsArray.sort((a, b) => b.createdAt - a.createdAt);
                callback(postsArray);
            } else {
                callback([]);
            }
        });
        return unsubscribe;
    }

    /**
     * Create a new post in Realtime Database
     */
    static createPost(postId: string, authorId: string, authorEmail: string | null, authorName?: string): Promise<void> {
        const postRef = ref(database, `posts/${postId}`);
        return set(postRef, {
            authorId,
            authorEmail,
            authorName: authorName || null,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }

    /**
     * Subscribe to posts with pagination (initial load)
     * Returns the N newest posts ordered by createdAt descending
     */
    static subscribeToPostsPaginated(
        limit: number,
        callback: (posts: Array<{ id: string; authorId: string; authorEmail: string; authorName?: string; content: string; createdAt: number; updatedAt: number; exhibit?: number }>) => void
    ): () => void {
        const postsRef = ref(database, 'posts');
        // Firebase orders ascending, so limitToLast gets the newest posts
        const postsQuery = query(postsRef, orderByChild('createdAt'), limitToLast(limit));
        const unsubscribe = onValue(postsQuery, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const postsArray = Object.entries(data).map(([id, post]) => {
                    const postData = post as Record<string, unknown>;
                    return {
                        id,
                        authorId: postData.authorId as string,
                        authorEmail: postData.authorEmail as string,
                        authorName: postData.authorName as string | undefined,
                        content: (postData.content as string) || '',
                        createdAt: postData.createdAt as number,
                        updatedAt: postData.updatedAt as number,
                        exhibit: postData.exhibit as number | undefined,
                    };
                });
                // Reverse to get newest first (Firebase returns ascending order)
                postsArray.sort((a, b) => b.createdAt - a.createdAt);
                callback(postsArray);
            } else {
                callback([]);
            }
        });
        return unsubscribe;
    }

    /**
     * Load more posts older than the specified createdAt timestamp
     * Returns posts with createdAt < oldestCreatedAt, ordered by createdAt descending
     */
    static loadMorePosts(
        oldestCreatedAt: number,
        limit: number,
        callback: (posts: Array<{ id: string; authorId: string; authorEmail: string; authorName?: string; content: string; createdAt: number; updatedAt: number; exhibit?: number }>) => void
    ): () => void {
        const postsRef = ref(database, 'posts');
        // Get posts older than oldestCreatedAt (endAt is exclusive, so use oldestCreatedAt - 1)
        const postsQuery = query(postsRef, orderByChild('createdAt'), endAt(oldestCreatedAt - 1), limitToLast(limit));
        const unsubscribe = onValue(postsQuery, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const postsArray = Object.entries(data).map(([id, post]) => {
                    const postData = post as Record<string, unknown>;
                    return {
                        id,
                        authorId: postData.authorId as string,
                        authorEmail: postData.authorEmail as string,
                        authorName: postData.authorName as string | undefined,
                        content: (postData.content as string) || '',
                        createdAt: postData.createdAt as number,
                        updatedAt: postData.updatedAt as number,
                        exhibit: postData.exhibit as number | undefined,
                    };
                });
                // Reverse to get newest first (Firebase returns ascending order)
                postsArray.sort((a, b) => b.createdAt - a.createdAt);
                callback(postsArray);
            } else {
                callback([]);
            }
        });
        return unsubscribe;
    }

    /**
     * Load more posts (one-time fetch) older than the specified createdAt timestamp
     * Returns posts with createdAt < oldestCreatedAt, ordered by createdAt descending
     */
    static async loadMorePostsOnce(
        oldestCreatedAt: number,
        limit: number
    ): Promise<Array<{ id: string; authorId: string; authorEmail: string; authorName?: string; content: string; createdAt: number; updatedAt: number; exhibit?: number }>> {
        const postsRef = ref(database, 'posts');
        // Get posts older than oldestCreatedAt (endAt is exclusive, so use oldestCreatedAt - 1)
        const postsQuery = query(postsRef, orderByChild('createdAt'), endAt(oldestCreatedAt - 1), limitToLast(limit));
        const snapshot = await get(postsQuery);

        const data = snapshot.val();
        if (data) {
            const postsArray = Object.entries(data).map(([id, post]) => {
                const postData = post as Record<string, unknown>;
                return {
                    id,
                    authorId: postData.authorId as string,
                    authorEmail: postData.authorEmail as string,
                    authorName: postData.authorName as string | undefined,
                    content: (postData.content as string) || '',
                    createdAt: postData.createdAt as number,
                    updatedAt: postData.updatedAt as number,
                    exhibit: postData.exhibit as number | undefined,
                };
            });
            // Reverse to get newest first (Firebase returns ascending order)
            postsArray.sort((a, b) => b.createdAt - a.createdAt);
            return postsArray;
        } else {
            return [];
        }
    }

    /**
     * Subscribe to a single post for real-time updates
     * Returns the post data or null if deleted
     */
    static subscribeToPost(
        postId: string,
        callback: (post: { id: string; authorId: string; authorEmail: string; authorName?: string; content: string; createdAt: number; updatedAt: number; exhibit?: number } | null) => void
    ): () => void {
        const postRef = ref(database, `posts/${postId}`);
        const unsubscribe = onValue(postRef, (snapshot) => {
            if (snapshot.exists()) {
                const postData = snapshot.val() as Record<string, unknown>;
                callback({
                    id: postId,
                    authorId: postData.authorId as string,
                    authorEmail: postData.authorEmail as string,
                    authorName: postData.authorName as string | undefined,
                    content: (postData.content as string) || '',
                    createdAt: postData.createdAt as number,
                    updatedAt: postData.updatedAt as number,
                    exhibit: postData.exhibit as number | undefined,
                });
            } else {
                callback(null);
            }
        });
        return unsubscribe;
    }

    /**
     * Subscribe to artifacts collection in Firestore
     */
    static subscribeToArtifacts(callback: (artifacts: Array<{
        id: string;
        title: string;
        description: string;
        content: string;
        exhibitId: number;
        thumbnailUrl?: string;
        type: 'video' | 'slideshow' | 'document' | 'gallery';
        createdAt: number;
        updatedAt: number;
    }>) => void): FirestoreUnsubscribe {
        const artifactsRef = collection(firestore, 'artifacts');
        const artifactsQuery = firestoreQuery(artifactsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(artifactsQuery, (snapshot) => {
            const artifactsArray = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: (data.title as string) || '',
                    description: (data.description as string) || '',
                    content: (data.content as string) || '',
                    exhibitId: (data.exhibitId as number) || 0,
                    thumbnailUrl: data.thumbnailUrl as string | undefined,
                    type: (data.type as 'video' | 'slideshow' | 'document' | 'gallery') || 'document',
                    createdAt: (data.createdAt as number) || Date.now(),
                    updatedAt: (data.updatedAt as number) || Date.now(),
                };
            });
            callback(artifactsArray);
        });
        return unsubscribe;
    }

    /**
     * Create a new artifact in Firestore
     */
    static async createArtifact(artifact: {
        title: string;
        description: string;
        content: string;
        exhibitId: number;
        thumbnailUrl?: string;
        type: 'video' | 'slideshow' | 'document' | 'gallery';
    }): Promise<string> {
        const artifactsRef = collection(firestore, 'artifacts');
        // Filter out undefined values as Firestore doesn't accept them
        const data: Record<string, unknown> = {
            title: artifact.title,
            description: artifact.description,
            content: artifact.content,
            exhibitId: artifact.exhibitId,
            type: artifact.type,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        if (artifact.thumbnailUrl) {
            data.thumbnailUrl = artifact.thumbnailUrl;
        }
        const docRef = await addDoc(artifactsRef, data);
        return docRef.id;
    }

    /**
     * Update an existing artifact in Firestore
     */
    static updateArtifact(artifactId: string, updates: Partial<{
        title: string;
        description: string;
        content: string;
        exhibitId: number;
        thumbnailUrl: string;
        type: 'video' | 'slideshow' | 'document' | 'gallery';
    }>): Promise<void> {
        const artifactRef = doc(firestore, 'artifacts', artifactId);
        // Filter out undefined values as Firestore doesn't accept them
        const data: Record<string, unknown> = { updatedAt: Date.now() };
        if (updates.title !== undefined) data.title = updates.title;
        if (updates.description !== undefined) data.description = updates.description;
        if (updates.content !== undefined) data.content = updates.content;
        if (updates.exhibitId !== undefined) data.exhibitId = updates.exhibitId;
        if (updates.thumbnailUrl !== undefined) data.thumbnailUrl = updates.thumbnailUrl;
        if (updates.type !== undefined) data.type = updates.type;
        return updateDoc(artifactRef, data);
    }

    /**
     * Delete an artifact from Firestore
     */
    static deleteArtifact(artifactId: string): Promise<void> {
        const artifactRef = doc(firestore, 'artifacts', artifactId);
        return deleteDoc(artifactRef);
    }
}
