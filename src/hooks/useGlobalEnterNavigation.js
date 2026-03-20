import { useEffect } from 'react';

const useGlobalEnterNavigation = () => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key !== 'Enter') return;

            const target = e.target;
            if (!target || typeof target !== 'object') return;
            const tagName = target.tagName?.toLowerCase();
            const allowTextareaEnterNav = typeof target.closest === 'function'
                ? !!target.closest('[data-enter-nav-textarea="true"]')
                : false;

            // 1. Initial filters
            // Skip buttons (Enter should click them)
            if (tagName === 'button' || target.type === 'button' || target.type === 'submit') {
                return;
            }

            // Skip checkboxes/radios (Enter often toggles/checks them)
            if (target.type === 'checkbox' || target.type === 'radio') {
                return;
            }

            // Only intercept for inputs/selects.
            // For textarea: default keeps newline, unless explicitly enabled by container.
            if (tagName !== 'input' && tagName !== 'select' && tagName !== 'textarea') return;
            if (tagName === 'textarea' && !allowTextareaEnterNav) return;

            if (e.defaultPrevented) return;

            // 2. Identify the focus scope (Modal/Drawer awareness)
            // Look for the nearest container that defines a focus trap (like a modal or drawer)
            const scope = typeof target.closest === 'function'
                ? (target.closest('[role="dialog"], [class*="modal"], [class*="drawer"], [class*="overlay"]') || document.body)
                : document.body;

            const focusableSelector = 'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]):not([data-enter-nav-skip="true"]), [tabindex]:not([tabindex="-1"])';

            // Query all possible elements within the current scope
            const focusableElements = Array.from(scope.querySelectorAll(focusableSelector))
                .filter(el => {
                    // Check if the element is actually visible to the user
                    const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
                    if (!isVisible) return false;

                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                });

            const index = focusableElements.indexOf(target);

            if (index > -1) {
                // Determine next element to focus
                let nextIndex;
                if (e.shiftKey) {
                    nextIndex = index - 1 >= 0 ? index - 1 : focusableElements.length - 1;
                } else {
                    nextIndex = index + 1 < focusableElements.length ? index + 1 : 0;
                }

                const nextEl = focusableElements[nextIndex];
                if (nextEl) {
                    e.preventDefault();
                    nextEl.focus();

                    // If it's a text input, select the text for easier editing
                    if (['text', 'number', 'password', 'search', 'email', 'tel'].includes(nextEl.type) || nextEl.tagName?.toLowerCase() === 'input') {
                        setTimeout(() => {
                            try {
                                if (typeof nextEl.select === 'function') nextEl.select();
                            } catch (err) {
                                // Ignore if select is not supported
                            }
                        }, 10);
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);
};

export default useGlobalEnterNavigation;
