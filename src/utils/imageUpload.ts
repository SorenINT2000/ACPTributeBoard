import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseConfig';

/**
 * Extract storage path from a Firebase Storage download URL.
 * Handles formats like: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media
 */
function getStoragePathFromUrl(url: string): string | null {
    try {
        const match = url.match(/\/o\/([^?]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Delete a file from Firebase Storage by its download URL.
 * Only deletes if the URL appears to be from our Storage bucket (artifacts or post-images).
 * Silently ignores errors (e.g. file already deleted, permission denied).
 */
export async function deleteStorageFileByUrl(url: string): Promise<void> {
    const path = getStoragePathFromUrl(url);
    if (!path) return;
    if (!path.startsWith('artifacts/') && !path.startsWith('post-images/')) {
        return; // Only delete our own uploads
    }
    try {
        const fileRef = ref(storage, path);
        await deleteObject(fileRef);
    } catch (error) {
        console.warn('Failed to delete storage file:', url, error);
    }
}

/**
 * Delete multiple files from Firebase Storage by their URLs.
 * Runs deletions in parallel; each failure is logged but does not block others.
 */
export async function deleteStorageFilesByUrls(urls: string[]): Promise<void> {
    await Promise.all(urls.map(url => deleteStorageFileByUrl(url)));
}

/**
 * Upload an image file to Firebase Storage
 * @param file - The image file to upload
 * @param postId - The ID of the post this image belongs to
 * @returns The download URL of the uploaded image
 */
export async function uploadImageToStorage(file: File, postId: string): Promise<string> {
    // Generate a unique filename using timestamp and random string
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'png';
    const filename = `${timestamp}-${randomStr}.${extension}`;
    
    // Create a reference to the storage location
    const imageRef = ref(storage, `post-images/${postId}/${filename}`);
    
    // Upload the file
    const snapshot = await uploadBytes(imageRef, file, {
        contentType: file.type,
    });
    
    // Get and return the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
}

/**
 * Upload an artifact file to Firebase Storage
 * @param file - The file to upload (PDF, images, etc.)
 * @param exhibitId - The exhibit number this artifact belongs to
 * @returns The public download URL of the uploaded file (no token required since artifacts are public)
 */
export async function uploadArtifactFile(file: File, exhibitId: number): Promise<string> {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'bin';
    const filename = `${timestamp}-${randomStr}.${extension}`;
    
    const storagePath = `artifacts/exhibit-${exhibitId}/${filename}`;
    const fileRef = ref(storage, storagePath);
    
    await uploadBytes(fileRef, file, {
        contentType: file.type,
    });
    
    // Return public URL (without token) since artifacts have public read access
    // This allows external viewers (Office Online, Google Docs) to access the file
    const bucket = 'acptributeboard.firebasestorage.app';
    const encodedPath = encodeURIComponent(storagePath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    
    return publicUrl;
}

/**
 * Check if a string is a base64 data URL
 */
export function isBase64DataUrl(str: string): boolean {
    return str.startsWith('data:image/');
}

/**
 * Convert a base64 data URL to a File object
 */
export function base64ToFile(dataUrl: string, filename: string = 'image.png'): File {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}
