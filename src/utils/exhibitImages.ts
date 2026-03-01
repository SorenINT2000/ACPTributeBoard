import { ref, listAll, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { convertToWebP } from './convertToWebP';

export interface ExhibitImageEntry {
    name: string;
    url: string;
}

export async function getExhibitImages(exhibitNumber: number): Promise<string[]> {
    const entries = await getExhibitImageEntries(exhibitNumber);
    return entries.map(e => e.url);
}

export async function getExhibitImageEntries(exhibitNumber: number): Promise<ExhibitImageEntry[]> {
    const folderRef = ref(storage, `website-images/exhibits/exhibit-${exhibitNumber}`);
    const result = await listAll(folderRef);
    const sorted = result.items.sort((a, b) => a.name.localeCompare(b.name));
    const entries = await Promise.all(
        sorted.map(async item => ({
            name: item.name,
            url: await getDownloadURL(item),
        })),
    );
    return entries;
}

export async function uploadExhibitImage(
    file: File,
    exhibitNumber: number,
    index: number,
): Promise<ExhibitImageEntry> {
    const converted = await convertToWebP(file);
    const prefix = String(index).padStart(3, '0');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = converted.name.split('.').pop() || 'webp';
    const fileName = `${prefix}-${timestamp}-${random}.${ext}`;

    const fileRef = ref(storage, `website-images/exhibits/exhibit-${exhibitNumber}/${fileName}`);
    await uploadBytes(fileRef, converted, { contentType: converted.type });
    const url = await getDownloadURL(fileRef);
    return { name: fileName, url };
}

export async function deleteExhibitImage(exhibitNumber: number, fileName: string): Promise<void> {
    const fileRef = ref(storage, `website-images/exhibits/exhibit-${exhibitNumber}/${fileName}`);
    await deleteObject(fileRef);
}
