import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-caret';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import FileHandler from '@tiptap/extension-file-handler';
import Emoji, { emojis } from '@tiptap/extension-emoji';
import * as Y from 'yjs';
import { YjsRealtimeDatabaseProvider } from '../providers/YjsRealtimeDatabaseProvider';
import { uploadImageToStorage } from '../utils/imageUpload';

interface UseYjsOptions {
    /** The ID of the post/document to edit. Pass null when not editing. */
    postId: string | null;
    /** The current user's ID */
    userId: string | null;
    /** The current user's display name or email */
    userName: string | null;
}

interface UseYjsResult {
    /** The TipTap editor instance */
    editor: Editor | null;
    /** Whether the collaborative editing session is ready */
    isReady: boolean;
    /** Delete the current post */
    deletePost: () => Promise<void>;
    /** Check if the editor content is empty */
    isEmpty: () => boolean;
    /** Upload an image file and insert it into the editor */
    uploadImage: (file: File) => Promise<void>;
}

/**
 * Custom hook for collaborative editing with Yjs and TipTap.
 * 
 * This hook manages:
 * - Y.Doc creation and lifecycle
 * - Firebase Realtime Database sync via YjsRealtimeDatabaseProvider
 * - TipTap editor with Collaboration extension
 * - Content syncing back to Firebase for feed display
 */
export function useYjs({ postId, userId, userName }: UseYjsOptions): UseYjsResult {
    // Track the Y.Doc and provider for the current post
    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<YjsRealtimeDatabaseProvider | null>(null);

    // State to trigger editor recreation when Y.Doc changes
    const [ydoc, setYdoc] = useState<Y.Doc>(() => new Y.Doc());
    const [provider, setProvider] = useState<YjsRealtimeDatabaseProvider | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Generate a consistent color for the user based on their ID
    const userColor = userId
        ? `#${userId.slice(0, 6).split('').map(c => {
            const num = parseInt(c, 36);
            return num.toString(16);
        }).join('').padEnd(6, '0').slice(0, 6)}`
        : '#888888';

    // Track postId in a ref for use in image upload callbacks
    const postIdRef = useRef<string | null>(postId);
    useEffect(() => {
        postIdRef.current = postId;
    }, [postId]);

    // Helper function to handle image upload
    const handleImageUpload = useCallback(async (file: File, currentEditor: Editor, position: number) => {
        const currentPostId = postIdRef.current;
        if (!currentPostId) {
            console.error('Cannot upload image: no postId available');
            return;
        }

        try {
            // Upload to Firebase Storage
            const downloadURL = await uploadImageToStorage(file, currentPostId);
            
            // Insert the image with the Firebase Storage URL
            currentEditor
                .chain()
                .insertContentAt(position, {
                    type: 'image',
                    attrs: {
                        src: downloadURL,
                    },
                })
                .focus()
                .run();
        } catch (error) {
            console.error('Failed to upload image:', error);
            // Fallback: show an error message or insert a placeholder
            // For now, we'll just log the error
        }
    }, []);

    // Create the TipTap editor with Collaboration extension
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Disable undo/redo since Yjs handles it
                undoRedo: false,
            }),
            Collaboration.configure({
                document: ydoc,
            }),
            // Text alignment for paragraphs and headings
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            // Placeholder text
            Placeholder.configure({
                placeholder: 'Start writing your recognition post...',
            }),
            // Image extension - disable base64 to prevent storing large strings
            Image.configure({
                allowBase64: false,
            }),
            // File handler for paste and drop images - uploads to Firebase Storage
            FileHandler.configure({
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
                onDrop: (currentEditor, files, pos) => {
                    files.forEach(file => {
                        handleImageUpload(file, currentEditor, pos);
                    });
                },
                onPaste: (currentEditor, files, htmlContent) => {
                    // If there is htmlContent, stop manual insertion & let other extensions handle insertion via inputRule
                    // This handles cases like copy/pasted GIFs from other apps (they have URL, not file data)
                    if (htmlContent) {
                        return false;
                    }

                    files.forEach(file => {
                        handleImageUpload(file, currentEditor, currentEditor.state.selection.anchor);
                    });
                },
            }),
            // Emoji extension - type :emoji_name: to insert emojis
            Emoji.configure({
                emojis,
                enableEmoticons: true, // Convert :) to 😊 etc.
            }),
            // Only include cursor sync when we have a provider
            ...(provider && userId ? [
                CollaborationCursor.configure({
                    provider: {
                        awareness: provider.getAwareness(),
                    },
                    user: {
                        name: userName || 'Anonymous',
                        color: userColor,
                    },
                }),
            ] : []),
        ],
        editorProps: {
            attributes: {
                class: 'tiptap-content',
            },
            handleDOMEvents: {
                focus: () => {
                    providerRef.current?.setEditorFocused(true);
                    return false;
                },
                blur: () => {
                    providerRef.current?.setEditorFocused(false);
                    return false;
                },
            },
        },
    }, [ydoc, provider, userId, userName, userColor, handleImageUpload]);

    // Set up Y.Doc and provider when postId changes
    useEffect(() => {
        // Can't set up collaboration without a user or post
        if (!userId || !postId) {
            // Clean up any existing provider
            if (providerRef.current) {
                providerRef.current.destroy();
                providerRef.current = null;
            }
            ydocRef.current = null;
            return;
        }

        // Create new Y.Doc for this post
        const newYdoc = new Y.Doc();
        ydocRef.current = newYdoc;

        // Create provider for syncing with Firebase
        const rtdbPath = `posts/${postId}`;
        const newProvider = new YjsRealtimeDatabaseProvider(
            newYdoc,
            rtdbPath,
            userId,
            postId
        );
        providerRef.current = newProvider;

        // Defer state updates to avoid synchronous setState warning
        const timeoutId = setTimeout(() => {
            setYdoc(newYdoc);
            setProvider(newProvider);
            setIsReady(true);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            // Cleanup on unmount or when postId changes
            newProvider.destroy();
            if (providerRef.current === newProvider) {
                providerRef.current = null;
            }
            ydocRef.current = null;
            setProvider(null);
            setIsReady(false);
        };
    }, [postId, userId]);

    // Sync editor content back to Firebase for feed display
    useEffect(() => {
        if (!editor || !postId || !ydoc || !provider) {
            return;
        }

        let syncTimeout: ReturnType<typeof setTimeout> | null = null;
        let isSyncing = false;
        let lastSyncedContent = '';

        const syncContent = () => {
            if (isSyncing || !providerRef.current) return;

            const html = editor.getHTML();
            if (html === lastSyncedContent) return;

            if (syncTimeout) {
                clearTimeout(syncTimeout);
            }

            syncTimeout = setTimeout(() => {
                if (isSyncing || !providerRef.current) return;

                isSyncing = true;
                providerRef.current.updatePostContent(html)
                    .then(() => {
                        lastSyncedContent = html;
                    })
                    .catch((error) => {
                        console.error('Error syncing content:', error);
                    })
                    .finally(() => {
                        setTimeout(() => {
                            isSyncing = false;
                        }, 200);
                    });
            }, 500);
        };

        // Listen to both editor updates and Yjs updates
        const handleEditorUpdate = () => syncContent();
        const handleYjsUpdate = () => {
            setTimeout(() => {
                if (editor && !editor.isDestroyed) {
                    syncContent();
                }
            }, 200);
        };

        editor.on('update', handleEditorUpdate);
        ydoc.on('update', handleYjsUpdate);

        return () => {
            editor.off('update', handleEditorUpdate);
            ydoc.off('update', handleYjsUpdate);
            if (syncTimeout) {
                clearTimeout(syncTimeout);
            }
        };
    }, [editor, postId, ydoc, provider]);

    // Helper to delete the current post
    const deletePost = useCallback(async () => {
        if (providerRef.current) {
            await providerRef.current.deletePost();
        }
    }, []);

    // Helper to check if content is empty
    const isEmpty = useCallback(() => {
        if (!editor) return true;
        const html = editor.getHTML();
        return !html || html === '<p></p>' || html.trim() === '';
    }, [editor]);

    // Helper to upload an image and insert it into the editor
    const uploadImage = useCallback(async (file: File) => {
        if (!editor) return;
        await handleImageUpload(file, editor, editor.state.selection.anchor);
    }, [editor, handleImageUpload]);

    return {
        editor,
        isReady,
        deletePost,
        isEmpty,
        uploadImage,
    };
}

