/** 部署時若 Worker 與前端不同網域，於 .env 設定 VITE_API_BASE */
export function apiUrl(path) {
    const base = import.meta.env.VITE_API_BASE;
    if (base && typeof base === 'string') {
        return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    }
    return path;
}
