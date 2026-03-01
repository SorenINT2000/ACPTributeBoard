import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import FileHandler from '@tiptap/extension-file-handler';
import Emoji, { emojis } from '@tiptap/extension-emoji';
import { uploadPostImageToStorage } from '../utils/imageUpload';
import { getPostContent, updatePostContent, deletePost as deletePostService } from './postService';

interface UsePostEditorOptions {
    postId: string | null;
    userId: string | null;
}

interface UsePostEditorResult {
    editor: Editor | null;
    isReady: boolean;
    isDirty: boolean;
    isSaving: boolean;
    save: () => Promise<void>;
    deletePost: () => Promise<void>;
    isEmpty: () => boolean;
    uploadImage: (file: File) => Promise<void>;
}

export function usePostEditor({ postId, userId }: UsePostEditorOptions): UsePostEditorResult {
    const [isReady, setIsReady] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const postIdRef = useRef<string | null>(postId);
    const lastSyncedRef = useRef('');
    const isSettingContentRef = useRef(false);

    useEffect(() => { postIdRef.current = postId; }, [postId]);

    const handleImageUpload = useCallback(async (file: File, currentEditor: Editor, position: number) => {
        const pid = postIdRef.current;
        if (!pid) return;
        try {
            const url = await uploadPostImageToStorage(file, pid);
            currentEditor.chain().insertContentAt(position, { type: 'image', attrs: { src: url } }).focus().run();
        } catch (error) {
            console.error('Failed to upload image:', error);
        }
    }, []);

    const saveRef = useRef<(() => Promise<void>) | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Placeholder.configure({ placeholder: 'Start writing your recognition post...' }),
            Image.configure({ allowBase64: false }),
            FileHandler.configure({
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
                onDrop: (currentEditor, files, pos) => {
                    files.forEach(file => handleImageUpload(file, currentEditor, pos));
                },
                onPaste: (currentEditor, files, htmlContent) => {
                    if (htmlContent) return false;
                    files.forEach(file => handleImageUpload(file, currentEditor, currentEditor.state.selection.anchor));
                },
            }),
            Emoji.configure({ emojis, enableEmoticons: true }),
        ],
        editorProps: {
            attributes: { class: 'tiptap-content' },
            handleKeyDown: (_view, event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                    event.preventDefault();
                    saveRef.current?.();
                    return true;
                }
                return false;
            },
        },
    }, [handleImageUpload]);

    // Load content from Firestore when postId changes
    useEffect(() => {
        if (!postId || !userId || !editor) {
            setIsReady(false);
            setIsDirty(false);
            return;
        }

        let cancelled = false;
        setIsReady(false);
        setIsDirty(false);

        getPostContent(postId).then(html => {
            if (cancelled || !editor || editor.isDestroyed) return;
            isSettingContentRef.current = true;
            editor.commands.setContent(html || '');
            lastSyncedRef.current = editor.getHTML();
            isSettingContentRef.current = false;
            setIsReady(true);
        }).catch(err => {
            console.error('Failed to load post content:', err);
            if (!cancelled) setIsReady(true);
        });

        return () => { cancelled = true; };
    }, [postId, userId, editor]);

    // Track dirty state on editor updates
    useEffect(() => {
        if (!editor || !isReady) return;

        const onUpdate = () => {
            if (isSettingContentRef.current) return;
            setIsDirty(true);
        };

        editor.on('update', onUpdate);
        return () => { editor.off('update', onUpdate); };
    }, [editor, isReady]);

    const save = useCallback(async () => {
        const pid = postIdRef.current;
        if (!pid || !editor || editor.isDestroyed) return;
        const html = editor.getHTML();
        if (html === lastSyncedRef.current) {
            setIsDirty(false);
            return;
        }
        setIsSaving(true);
        try {
            await updatePostContent(pid, html);
            lastSyncedRef.current = html;
            setIsDirty(false);
        } catch (err) {
            console.error('Error saving content:', err);
        } finally {
            setIsSaving(false);
        }
    }, [editor]);

    useEffect(() => { saveRef.current = save; }, [save]);

    // Clear editor content when postId becomes null
    useEffect(() => {
        if (!postId && editor && !editor.isDestroyed) {
            isSettingContentRef.current = true;
            editor.commands.setContent('');
            lastSyncedRef.current = '';
            isSettingContentRef.current = false;
            setIsDirty(false);
        }
    }, [postId, editor]);

    const deletePost = useCallback(async () => {
        const pid = postIdRef.current;
        if (pid) await deletePostService(pid);
    }, []);

    const isEmpty = useCallback(() => {
        if (!editor) return true;
        const html = editor.getHTML();
        return !html || html === '<p></p>' || html.trim() === '';
    }, [editor]);

    const uploadImage = useCallback(async (file: File) => {
        if (!editor) return;
        await handleImageUpload(file, editor, editor.state.selection.anchor);
    }, [editor, handleImageUpload]);

    return { editor, isReady, isDirty, isSaving, save, deletePost, isEmpty, uploadImage };
}
