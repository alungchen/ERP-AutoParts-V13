/** 製單明細表或零件選取視窗內（含輸入焦點） */
export function isElementInDocPartEditingZone(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return !!(
        el.closest('[data-doc-items-zone]') ||
        el.closest('[data-doc-picker-zone]')
    );
}
