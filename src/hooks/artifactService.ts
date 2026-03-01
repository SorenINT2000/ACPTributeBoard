import {
    collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
    query, orderBy, type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../firebaseConfig';

export interface Artifact {
    id: string;
    title: string;
    description: string;
    content: string;
    exhibitId: number;
    thumbnailUrl?: string;
    type: 'video' | 'slideshow' | 'document' | 'gallery';
    createdAt: number;
    updatedAt: number;
}

const artifactsRef = collection(firestore, 'artifacts');

export function subscribeToArtifacts(callback: (artifacts: Artifact[]) => void): Unsubscribe {
    const q = query(artifactsRef, orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                title: (data.title as string) || '',
                description: (data.description as string) || '',
                content: (data.content as string) || '',
                exhibitId: (data.exhibitId as number) || 0,
                thumbnailUrl: data.thumbnailUrl as string | undefined,
                type: (data.type as Artifact['type']) || 'document',
                createdAt: (data.createdAt as number) || Date.now(),
                updatedAt: (data.updatedAt as number) || Date.now(),
            };
        }));
    });
}

export async function createArtifact(artifact: {
    title: string;
    description: string;
    content: string;
    exhibitId: number;
    thumbnailUrl?: string;
    type: Artifact['type'];
}): Promise<string> {
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

export function updateArtifact(
    artifactId: string,
    updates: Partial<{
        title: string;
        description: string;
        content: string;
        exhibitId: number;
        thumbnailUrl: string;
        type: Artifact['type'];
    }>,
): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.content !== undefined) data.content = updates.content;
    if (updates.exhibitId !== undefined) data.exhibitId = updates.exhibitId;
    if (updates.thumbnailUrl !== undefined) data.thumbnailUrl = updates.thumbnailUrl;
    if (updates.type !== undefined) data.type = updates.type;
    return updateDoc(doc(artifactsRef, artifactId), data);
}

export function deleteArtifact(artifactId: string): Promise<void> {
    return deleteDoc(doc(artifactsRef, artifactId));
}
