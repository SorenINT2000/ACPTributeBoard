export async function convertToWebP(file: File, quality = 0.85): Promise<File> {
    if (file.type === 'image/webp' || !file.type.startsWith('image/')) {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
}
