import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { useAppStore } from './store/useAppStore'

// Patch fetch globally to automatically append X-Active-Branch header for /api requests
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const urlStr = typeof url === 'string' ? url : (url && url.url) || '';
  if (urlStr.includes('/api/')) {
    const activeBranchId = useAppStore.getState().activeBranchId || 'songshan';

    if (urlStr.includes('/api/products')) {
      try {
        const urlObj = new URL(urlStr, window.location.origin);
        urlObj.searchParams.set('branch_id', activeBranchId);
        url = urlObj.toString();
      } catch {
        // keep original URL if it is not a valid absolute/relative URL
      }
    }

    const headers = options.headers ? { ...options.headers } : {};
    if (headers instanceof Headers) {
      headers.set('X-Active-Branch', activeBranchId);
    } else {
      headers['X-Active-Branch'] = activeBranchId;
    }

    options.headers = headers;
  }
  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
