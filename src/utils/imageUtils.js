export function getSafeImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://')) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
}

/** 是否為外連圖（http/https）；R2 已搬家者為 /api/images?path=… */
export function isExternalHttpImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
}

/** images 陣列是否至少含一張外連網址圖（列表「實體照片」欄底色標示） */
export function productHasExternalUrlImages(images) {
    if (!Array.isArray(images) || images.length === 0) return false;
    return images.some(isExternalHttpImageUrl);
}
