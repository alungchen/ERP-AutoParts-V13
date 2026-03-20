import { useEffect } from 'react';

/**
 * 搜尋表單鍵盤導覽：
 * 1) Enter -> 下一個搜尋欄位
 * 2) Shift+Enter -> 上一個搜尋欄位
 * 3) Tab -> 直接聚焦「查詢」按鈕（僅在提供 searchBtnRef 時）
 * 4) 左/右鍵：可於「最後一欄 / 查詢 / 重設」之間移動（無查詢鈕時為「最後一欄 / 重設」）
 * 5) 任一輸入欄位按 Esc -> 聚焦查詢按鈕，無查詢鈕時聚焦重設
 * 6) 查詢按鈕按 Esc -> 依 searchEscapeGoesToReset 回到重設按鈕或第一欄
 * @param {React.RefObject} formRef
 * @param {React.RefObject|null} searchBtnRef 可為 null（例如即時篩選、無「查詢」按鈕時）
 * @param {React.RefObject} resetBtnRef
 * @param {{ enabled?: boolean, searchEscapeGoesToReset?: boolean }} [options]
 */
export function useSearchFormKeyboardNav(formRef, searchBtnRef, resetBtnRef, options = {}) {
    useEffect(() => {
        if (options.enabled === false) return;
        if (!formRef?.current || !resetBtnRef?.current) return;

        const form = formRef.current;
        const searchBtn = searchBtnRef?.current ?? null;
        const resetBtn = resetBtnRef.current;

        const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        const getFields = () => {
            const selector = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';
            return Array.from(form.querySelectorAll(selector))
                .filter((el) => el !== searchBtn && el !== resetBtn)
                .filter(isVisible);
        };

        const focusWithSelect = (el) => {
            if (!el) return;
            el.focus();
            const tag = el.tagName?.toLowerCase();
            if (tag !== 'input' && tag !== 'textarea') return;
            const value = el.value;
            if (typeof value !== 'string' || value.length === 0) return;
            requestAnimationFrame(() => {
                if (document.activeElement === el && typeof el.select === 'function') {
                    el.select();
                }
            });
        };

        const handleKeyDown = (e) => {
            // 若事件已被 AutocompleteInput 等子元件 preventDefault，不重複處理
            if (e.defaultPrevented) return;
            if (!form.contains(document.activeElement)) return;
            if (document.activeElement?.closest?.('ul')) return;

            const active = document.activeElement;
            const fields = getFields();
            if (fields.length === 0) return;
            const firstField = fields[0];
            const lastField = fields[fields.length - 1];

            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const triad = [lastField, searchBtn, resetBtn].filter(Boolean);
                const triadIdx = triad.indexOf(active);
                if (triadIdx !== -1) {
                    e.preventDefault();
                    const nextIdx = e.key === 'ArrowRight'
                        ? (triadIdx + 1) % triad.length
                        : (triadIdx - 1 + triad.length) % triad.length;
                    focusWithSelect(triad[nextIdx]);
                }
                return;
            }

            if (e.key === 'Escape') {
                if (searchBtn && active === searchBtn) {
                    e.preventDefault();
                    if (options.searchEscapeGoesToReset && resetBtn) {
                        resetBtn.focus();
                    } else {
                        focusWithSelect(firstField);
                    }
                    return;
                }
                // 任一輸入欄位按 Esc → 聚焦查詢按鈕，或無查詢鈕時聚焦重設
                if (fields.indexOf(active) !== -1) {
                    e.preventDefault();
                    if (searchBtn) {
                        searchBtn.focus();
                    } else {
                        resetBtn.focus();
                    }
                    return;
                }
            }

            if (e.key === 'Tab' && !e.shiftKey) {
                if (searchBtn) {
                    if (active !== searchBtn) {
                        e.preventDefault();
                        searchBtn.focus();
                    }
                }
                return;
            }

            if (e.key !== 'Enter') return;

            if (active.tagName?.toLowerCase() === 'textarea') return;

            const idx = fields.indexOf(active);
            if (idx === -1) return;

            e.preventDefault();
            if (e.shiftKey) {
                focusWithSelect(fields[Math.max(idx - 1, 0)]);
            } else if (idx === fields.length - 1) {
                if (searchBtn) {
                    searchBtn.focus();
                } else {
                    resetBtn.focus();
                }
            } else {
                focusWithSelect(fields[idx + 1]);
            }
        };

        form.addEventListener('keydown', handleKeyDown);
        return () => form.removeEventListener('keydown', handleKeyDown);
    }, [formRef, searchBtnRef, resetBtnRef, options.enabled, options.searchEscapeGoesToReset]);
}
