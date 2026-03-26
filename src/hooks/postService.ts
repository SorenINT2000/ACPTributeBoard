import {
    collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, onSnapshot,
    query, orderBy, limit, startAfter, type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import type { Post } from '../components/PostCard';

const postsRef = collection(firestore, 'posts');

function docToPost(id: string, data: Record<string, unknown>): Post {
    return {
        id,
        authorId: data.authorId as string,
        authorEmail: data.authorEmail as string,
        authorName: data.authorName as string | undefined,
        content: (data.content as string) || '',
        createdAt: data.createdAt as number,
        updatedAt: data.updatedAt as number,
        exhibit: data.exhibit as number | undefined,
    };
}

export function createPost(
    postId: string,
    authorId: string,
    authorEmail: string | null,
    authorName?: string,
    content = '',
): Promise<void> {
    const now = Date.now();
    return setDoc(doc(postsRef, postId), {
        authorId,
        authorEmail,
        authorName: authorName || null,
        content,
        createdAt: now,
        updatedAt: now,
        exhibit: null,
    });
}

export function updatePostContent(postId: string, content: string): Promise<void> {
    return updateDoc(doc(postsRef, postId), { content, updatedAt: Date.now() });
}

export function updatePostExhibit(postId: string, exhibitNumber: number | null): Promise<void> {
    return updateDoc(doc(postsRef, postId), { exhibit: exhibitNumber, updatedAt: Date.now() });
}

export function deletePost(postId: string): Promise<void> {
    return deleteDoc(doc(postsRef, postId));
}

export async function getPostContent(postId: string): Promise<string> {
    const snap = await getDoc(doc(postsRef, postId));
    if (!snap.exists()) return '';
    return (snap.data().content as string) || '';
}

export async function getPostsPaginated(count: number): Promise<Post[]> {
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => docToPost(d.id, d.data() as Record<string, unknown>));
}

export async function getMorePosts(oldestCreatedAt: number, count: number): Promise<Post[]> {
    const anchorSnap = await getDocs(
        query(postsRef, orderBy('createdAt', 'desc'), startAfter(oldestCreatedAt), limit(count)),
    );
    return anchorSnap.docs.map(d => docToPost(d.id, d.data() as Record<string, unknown>));
}

export function subscribeToPost(
    postId: string,
    callback: (post: Post | null) => void,
): Unsubscribe {
    return onSnapshot(doc(postsRef, postId), snap => {
        if (snap.exists()) {
            callback(docToPost(snap.id, snap.data() as Record<string, unknown>));
        } else {
            callback(null);
        }
    });
}

export function subscribeToNewestPost(
    callback: (post: Post | null) => void,
): Unsubscribe {
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, snap => {
        if (snap.empty) {
            callback(null);
        } else {
            const d = snap.docs[0];
            callback(docToPost(d.id, d.data() as Record<string, unknown>));
        }
    });
}

export function subscribeToAllPosts(
    callback: (posts: Post[]) => void,
): Unsubscribe {
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => docToPost(d.id, d.data() as Record<string, unknown>)));
    });
}
