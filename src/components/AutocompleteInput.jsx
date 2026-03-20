import React, { useState, useRef, useEffect } from 'react';

const AutocompleteInput = ({ value, onChange, placeholder, data, filterKey, labelKey, displayKey, required, width, onKeyDown, compact, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredData, setFilteredData] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalize = (v) => String(v ?? '').toLowerCase();
    const moveFocusWithinScope = (currentEl, goPrev = false) => {
        if (!currentEl || typeof currentEl.closest !== 'function') return;
        const scope = currentEl.closest('[role="dialog"], [class*="modal"], [class*="drawer"], [class*="overlay"]') || document.body;
        const focusableSelector = 'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]):not([data-enter-nav-skip="true"]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(scope.querySelectorAll(focusableSelector)).filter((el) => {
            const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
            if (!isVisible) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });

        const index = focusableElements.indexOf(currentEl);
        if (index === -1 || focusableElements.length === 0) return;
        const nextIndex = goPrev
            ? (index - 1 + focusableElements.length) % focusableElements.length
            : (index + 1) % focusableElements.length;
        focusableElements[nextIndex]?.focus();
    };

    const handleInputChange = (e) => {
        if (disabled) return;
        const val = e.target.value;
        onChange(val);

        if (val) {
            const matches = data.filter(item =>
                normalize(item?.[filterKey]).includes(normalize(val)) ||
                normalize(item?.[labelKey]).includes(normalize(val))
            );
            setFilteredData(matches);
            setIsOpen(true);
            setActiveIndex(-1);
        } else {
            setIsOpen(false);
        }
    };

    const handleSelect = (item) => {
        if (disabled) return;
        onChange(item[labelKey]);
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (disabled) return;
        let consumed = false;

        if (!isOpen) {
            if (e.key === 'Tab' || e.key === 'Enter') {
                const directMatch = data.find(item =>
                    normalize(item?.[filterKey]) === normalize(value) ||
                    normalize(item?.[labelKey]) === normalize(value)
                );
                if (directMatch) {
                    e.preventDefault();
                    onChange(directMatch?.[labelKey] ?? '');
                    setIsOpen(false);
                    moveFocusWithinScope(e.target, e.shiftKey && e.key === 'Enter');
                    consumed = true;
                }
            }
            if (!consumed && onKeyDown) onKeyDown(e);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => prev < filteredData.length - 1 ? prev + 1 : prev);
            consumed = true;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => prev > 0 ? prev - 1 : 0);
            consumed = true;
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (isOpen && (activeIndex >= 0 || filteredData.length > 0)) {
                e.preventDefault();
                e.stopPropagation();
                if (activeIndex >= 0 && activeIndex < filteredData.length) {
                    handleSelect(filteredData[activeIndex]);
                } else {
                    const exactMatch = filteredData.find(item =>
                        normalize(item?.[filterKey]) === normalize(value) ||
                        normalize(item?.[labelKey]) === normalize(value)
                    );
                    if (exactMatch) {
                        handleSelect(exactMatch);
                    } else if (filteredData.length > 0) {
                        handleSelect(filteredData[0]);
                    }
                }
                moveFocusWithinScope(e.target, e.shiftKey && e.key === 'Enter');
                consumed = true;
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            consumed = true;
        }
        if (!consumed && onKeyDown) onKeyDown(e);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: width || '100%' }} data-dropdown-open={isOpen && filteredData.length > 0 || undefined}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                border: `1px solid ${isFocused ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: '8px',
                padding: compact ? '0 8px' : '0 12px',
                opacity: disabled ? 0.6 : 1,
                boxShadow: isFocused ? '0 0 0 3px var(--accent-subtle)' : 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }}>
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        setIsFocused(false);
                        if (disabled) return;
                        const directMatch = data.find(item =>
                            normalize(item?.[filterKey]) === normalize(value) ||
                            normalize(item?.[labelKey]) === normalize(value)
                        );
                        if (directMatch) {
                            onChange(directMatch?.[labelKey] ?? '');
                        }
                    }}
                    onFocus={() => {
                        setIsFocused(true);
                        if (value && filteredData.length > 0 && !disabled) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        padding: compact ? '6px 0' : '10px 0',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: compact ? '13px' : '14px',
                        cursor: disabled ? 'not-allowed' : 'text'
                    }}
                />
            </div>

            {isOpen && filteredData.length > 0 && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                    zIndex: 50,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    listStyle: 'none',
                    padding: 0
                }}>
                    {filteredData.map((item, idx) => (
                        <li
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                background: activeIndex === idx ? 'var(--accent-subtle)' : 'transparent',
                                color: activeIndex === idx ? 'var(--accent-hover)' : 'inherit',
                            }}
                        >
                            <span>{item[labelKey]}</span>
                            <span style={{ fontSize: '12px', opacity: 0.6, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{item[filterKey]}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AutocompleteInput;
