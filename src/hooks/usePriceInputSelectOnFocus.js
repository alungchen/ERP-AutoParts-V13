import { useEffect } from 'react';

/**
 * 聚焦單價/售價/定價等數字欄位時全選欄位內已存在的數值
 */
export function usePriceInputSelectOnFocus() {
    useEffect(() => {
        const handleFocusIn = (e) => {
            const el = e.target;
            if (el?.tagName?.toLowerCase() !== 'input') return;
            if (el.type !== 'number') return;
            requestAnimationFrame(() => el.select());
        };

        const handleFocusOut = (e) => {
            const el = e.target;
            if (el?.tagName?.toLowerCase() !== 'input') return;
            if (el.type !== 'number') return;

            const raw = String(el.value ?? '').trim();
            if (!raw) return;

            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) return;

            const normalized = String(parsed);
            if (normalized === raw) return;

            // 例：02500 -> 2500，並同步觸發 React 的 onChange 更新 state
            el.value = normalized;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, []);
}
