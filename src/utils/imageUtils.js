export function getSafeImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://')) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
}
