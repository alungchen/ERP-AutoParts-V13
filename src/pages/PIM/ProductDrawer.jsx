import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Camera, Edit2, Trash2, CopyPlus, Save, XCircle, Eye, EyeOff } from 'lucide-react';
import { useProductStore } from '../../store/useProductStore';
import { useShorthandStore } from '../../store/useShorthandStore';
import { useTranslation } from '../../i18n';
import AutocompleteInput from '../../components/AutocompleteInput';
import styles from './ProductDrawer.module.css';

const ProductDrawer = () => {
    const { selectedProduct, setSelectedProduct, duplicateProduct, deleteProduct, updateProduct } = useProductStore();
    const { models, parts, brands } = useShorthandStore();
    const { t } = useTranslation();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(null);
    const [showBaseCost, setShowBaseCost] = useState(false);
    const [showSalesPrices, setShowSalesPrices] = useState(false);
    const fileInputRef = useRef(null);
    const stockInputRef = useRef(null);
    const safetyStockInputRef = useRef(null);
    const baseCostInputRef = useRef(null);
    const priceAInputRef = useRef(null);
    const partNumberInputRefs = useRef({});
    const [pendingFocusPnId, setPendingFocusPnId] = useState(null);
    const [enlargedImageIndex, setEnlargedImageIndex] = useState(null);
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [showUrlInput, setShowUrlInput] = useState(false);
    const editBtnRef = useRef(null);
    const duplicateBtnRef = useRef(null);
    const deleteBtnRef = useRef(null);
    const saveBtnRef = useRef(null);
    const cancelBtnRef = useRef(null);
    const closeBtnRef = useRef(null);
    const partNumberInputRef = useRef(null);
    const drawerRef = useRef(null);

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        alert(`準備上傳 ${files.length} 張照片到雲端...`);
        const newUploadedUrls = [];
        for (const file of files) {
            try {
                const fd = new FormData();
                fd.append('file', file);
                const res = await fetch('/api/images', {
                    method: 'POST',
                    body: fd
                });
                if (res.ok) {
                    const data = await res.json();
                    // 將 R2 API 網址存入資料庫
                    newUploadedUrls.push(`/api/images?path=${data.fileName}`);
                } else {
                    console.error('Failed to upload image', file.name);
                }
            } catch (err) {
                console.error('Upload Error:', err);
            }
        }

        if (newUploadedUrls.length > 0) {
            setFormData(prev => ({ 
                ...prev, 
                images: [...(prev.images || []), ...newUploadedUrls] 
            }));
        }
    };

    const handleAddUrlImage = () => {
        if (imageUrlInput.trim()) {
            setFormData({ ...formData, images: [...(formData.images || []), imageUrlInput.trim()] });
            setImageUrlInput("");
            setShowUrlInput(false);
        }
    };

    useEffect(() => {
        if (selectedProduct) {
            setFormData({ ...selectedProduct });
            setIsEditing(!!selectedProduct.isNew);
        } else {
            setFormData(null);
        }
    }, [selectedProduct]);

    useEffect(() => {
        // 開啟預覽模式後，自動聚焦「編輯產品」按鈕（非新增且非編輯中）
        if (!selectedProduct || isEditing || selectedProduct.isNew) return;
        const focusEditBtn = () => editBtnRef.current?.focus();
        focusEditBtn();
        const t1 = setTimeout(focusEditBtn, 80);
        const t2 = setTimeout(focusEditBtn, 220);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [selectedProduct, isEditing]);

    useEffect(() => {
        // 進入編輯模式時，聚焦在「零件編號」
        if (!selectedProduct || !isEditing) return;
        const focusPartNo = () => partNumberInputRef.current?.focus();
        focusPartNo();
        const t1 = setTimeout(focusPartNo, 80);
        const t2 = setTimeout(focusPartNo, 220);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [selectedProduct, isEditing]);

    useEffect(() => {
        if (enlargedImageIndex === null) return;

        const galleryImages = formData?.images || selectedProduct?.images || [];
        if (galleryImages.length === 0) {
            setEnlargedImageIndex(null);
            return;
        }

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setEnlargedImageIndex((prev) => (prev + 1) % galleryImages.length);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setEnlargedImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
            } else if (e.key === 'Escape') {
                setEnlargedImageIndex(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enlargedImageIndex, formData?.images, selectedProduct?.images]);

    useEffect(() => {
        if (!selectedProduct) return;
        const onKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            if (enlargedImageIndex !== null) return;
            if (drawerRef.current?.querySelector('[data-dropdown-open]')) return;
            e.preventDefault();
            setSelectedProduct(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedProduct, enlargedImageIndex, setSelectedProduct]);

    useEffect(() => {
        if (!pendingFocusPnId) return;
        const targetInput = partNumberInputRefs.current[pendingFocusPnId];
        if (!targetInput) return;
        targetInput.focus();
        if (typeof targetInput.select === 'function') targetInput.select();
        setPendingFocusPnId(null);
    }, [formData?.part_numbers, pendingFocusPnId]);

    const hasData = !!(selectedProduct && formData);
    const p = hasData ? (isEditing ? formData : selectedProduct) : null;

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
    };

    const handleSave = () => {
        updateProduct(formData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        if (selectedProduct.isNew) {
            setSelectedProduct(null);
            return;
        }
        setFormData({ ...selectedProduct });
        setIsEditing(false);
    };

    const confirmDelete = (label) => window.confirm(`確定要刪除「${label}」嗎？此操作無法復原。`);

    const handleEnterFocusByRef = (e, { nextRef, prevRef }) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const targetRef = e.shiftKey ? prevRef : nextRef;
        targetRef?.current?.focus();
    };

    const focusHeaderActionByArrow = (currentRef, direction) => {
        const refs = isEditing
            ? [saveBtnRef, cancelBtnRef, closeBtnRef]
            : [duplicateBtnRef, editBtnRef, deleteBtnRef, closeBtnRef];
        const idx = refs.findIndex((r) => r === currentRef);
        if (idx === -1) return;
        const nextIdx = direction === 'right'
            ? (idx + 1) % refs.length
            : (idx - 1 + refs.length) % refs.length;
        refs[nextIdx]?.current?.focus();
    };

    const handleHeaderActionKeyDown = (e, currentRef) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            focusHeaderActionByArrow(currentRef, 'right');
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            focusHeaderActionByArrow(currentRef, 'left');
        }
    };

    const handleSaveBtnKeyDown = (e) => {
        if (e.key === 'Enter') {
            // Enter：儲存後聚焦關閉鈕（Esc 為關閉整個抽屜，見全域 keydown）
            e.preventDefault();
            e.stopPropagation();
            handleSave();
            const focusClose = () => closeBtnRef.current?.focus();
            setTimeout(focusClose, 0);
            setTimeout(focusClose, 80);
            return;
        }
        handleHeaderActionKeyDown(e, saveBtnRef);
    };

    const handleDrawerEnterNavigation = (e) => {
        if (!isEditing) return;
        if (e.key !== 'Enter') return;
        if (e.defaultPrevented) return;

        const target = e.target;
        if (!target || typeof target !== 'object') return;
        const tag = target.tagName?.toLowerCase();

        // 按鈕/勾選框保留原行為
        if (tag === 'button' || target.type === 'button' || target.type === 'submit') return;
        if (target.type === 'checkbox' || target.type === 'radio') return;
        if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return;

        const scope = target.closest?.(`.${styles.drawer}`) || target.closest?.('[class*="drawer"]');
        if (!scope) return;

        const focusableSelector = 'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]):not([data-enter-nav-skip="true"]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(scope.querySelectorAll(focusableSelector)).filter((el) => {
            const visible = el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
            if (!visible) return false;
            const css = window.getComputedStyle(el);
            return css.display !== 'none' && css.visibility !== 'hidden' && css.opacity !== '0';
        });

        const idx = focusableElements.indexOf(target);
        if (idx === -1) return;

        e.preventDefault();
        const nextIdx = e.shiftKey
            ? (idx - 1 + focusableElements.length) % focusableElements.length
            : (idx + 1) % focusableElements.length;
        const nextEl = focusableElements[nextIdx];
        nextEl?.focus();
        if (nextEl && typeof nextEl.select === 'function' && nextEl.tagName?.toLowerCase() === 'input') {
            setTimeout(() => {
                try { nextEl.select(); } catch { /* ignore */ }
            }, 10);
        }
    };

    const handleAddPartNumberRow = () => {
        const newPnId = `PN-NEW-${Date.now()}`;
        const currentPartNumbers = formData?.part_numbers || [];
        setFormData({
            ...formData,
            part_numbers: [
                ...currentPartNumbers,
                { pn_id: newPnId, type: "OE", part_number: "", brand: "", car_model: "", year: "", note: "" }
            ]
        });
        setPendingFocusPnId(newPnId);
    };

    return (
        <div className={`${styles.overlay} ${selectedProduct ? styles.open : ''}`} onClick={() => setSelectedProduct(null)}>
            <div ref={drawerRef} className={styles.drawer} data-enter-nav-textarea="true" onClick={(e) => e.stopPropagation()} onKeyDown={handleDrawerEnterNavigation}>
                {!hasData ? (
                    <div />
                ) : (
                <>
                <div className={styles.header}>
                    <div className="flex-col gap-1">
                        <span className="text-muted text-xs font-mono">{p.p_id}</span>
                        {!isEditing ? (
                            <span className={styles.title}>{p.name || '未設定品名'}</span>
                        ) : (
                            <span className={styles.title}>{p.isNew ? '新增零件' : '編輯零件'}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    ref={saveBtnRef}
                                    className={`${styles.closeBtn} ${styles.headerActionBtn} text-success hover:bg-success-subtle`}
                                    title={t('pim.save')}
                                    onClick={handleSave}
                                    onKeyDown={handleSaveBtnKeyDown}
                                >
                                    <Save size={20} />
                                </button>
                                <button
                                    ref={cancelBtnRef}
                                    className={`${styles.closeBtn} ${styles.headerActionBtn} text-danger hover:bg-danger-subtle`}
                                    title={t('pim.cancel')}
                                    onClick={handleCancel}
                                    onKeyDown={(e) => handleHeaderActionKeyDown(e, cancelBtnRef)}
                                >
                                    <XCircle size={20} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    ref={duplicateBtnRef}
                                    className={`${styles.closeBtn} ${styles.headerActionBtn} text-accent-hover hover:bg-accent-subtle`}
                                    title={t('pim.duplicate')}
                                    onClick={() => duplicateProduct(p)}
                                    onKeyDown={(e) => handleHeaderActionKeyDown(e, duplicateBtnRef)}
                                >
                                    <CopyPlus size={20} />
                                </button>
                                <button
                                    ref={editBtnRef}
                                    className={`${styles.closeBtn} ${styles.headerActionBtn} ${styles.editPrimaryBtn} text-warning hover:bg-warning-subtle`}
                                    title={t('pim.edit')}
                                    onClick={() => setIsEditing(true)}
                                    onKeyDown={(e) => handleHeaderActionKeyDown(e, editBtnRef)}
                                >
                                    <Edit2 size={20} />
                                </button>
                                <button
                                    ref={deleteBtnRef}
                                    className={`${styles.closeBtn} ${styles.headerActionBtn} text-danger hover:bg-danger-subtle`}
                                    title={t('pim.delete')}
                                    onClick={() => {
                                        if (!confirmDelete(p.name || p.p_id)) return;
                                        deleteProduct(p.p_id);
                                    }}
                                    onKeyDown={(e) => handleHeaderActionKeyDown(e, deleteBtnRef)}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </>
                        )}
                        <div className="w-px h-6 bg-border-color mx-2"></div>
                        <button
                            ref={closeBtnRef}
                            className={`${styles.closeBtn} ${styles.headerActionBtn}`}
                            onClick={() => setSelectedProduct(null)}
                            onKeyDown={(e) => handleHeaderActionKeyDown(e, closeBtnRef)}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    {/* Row 1: 零件號碼 */}
                    <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                        <label className={styles.label}>{t('pim.thPartNo')}</label>
                        <input ref={partNumberInputRef} disabled={!isEditing} className={styles.input} value={formData.part_number || ''} placeholder={t('pim.thPartNo')} onChange={(e) => setFormData({ ...formData, part_number: e.target.value })} autoFocus={formData.isNew} />
                    </div>

                    {/* Row 2: 車型, 零件資料 */}
                    <div className="flex gap-3 flex-wrap mb-4">
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '150px' }}>
                            <label className={styles.label}>車種</label>
                            <AutocompleteInput
                                value={formData.car_model || ''}
                                onChange={(val) => setFormData({ ...formData, car_model: val })}
                                placeholder="支援片語搜尋..."
                                data={models}
                                filterKey="shorthand"
                                labelKey="fullname"
                                required={false}
                                compact={true}
                                disabled={!isEditing}
                            />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '150px' }}>
                            <label className={styles.label}>品名</label>
                            <AutocompleteInput
                                value={formData.name || ''}
                                onChange={(val) => setFormData({ ...formData, name: val })}
                                placeholder="支援片語搜尋..."
                                data={parts}
                                filterKey="shorthand"
                                labelKey="fullname"
                                required={true}
                                compact={true}
                                disabled={!isEditing}
                            />
                        </div>
                    </div>

                    {/* Row 3: 規格 */}
                    <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                        <label className={styles.label}>{t('pim.thSpec')}</label>
                        <input disabled={!isEditing} className={styles.input} value={formData.specifications || ''} placeholder={t('pim.thSpec')} onChange={(e) => setFormData({ ...formData, specifications: e.target.value })} />
                    </div>

                    {/* Row 4: 年份, 品牌 */}
                    <div className="flex gap-3 flex-wrap mb-4">
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '100px' }}>
                            <label className={styles.label}>{t('pim.thYear')}</label>
                            <input disabled={!isEditing} className={styles.input} value={formData.year || ''} placeholder={t('pim.thYear')} onChange={(e) => setFormData({ ...formData, year: e.target.value })} />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '120px' }}>
                            <label className={styles.label}>品牌 (Brand)</label>
                            <AutocompleteInput
                                value={formData.brand || ''}
                                onChange={(val) => setFormData({ ...formData, brand: val })}
                                placeholder="支援片語搜尋..."
                                data={brands}
                                filterKey="shorthand"
                                labelKey="fullname"
                                required={false}
                                compact={true}
                                disabled={!isEditing}
                            />
                        </div>
                    </div>

                    {/* Row 5: 備註 */}
                    <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                        <label className={styles.label}>備註 (Notes)</label>
                        <textarea
                            disabled={!isEditing}
                            className={styles.input}
                            style={{ minHeight: '80px', resize: 'vertical' }}
                            value={formData.notes || ''}
                            placeholder="輸入備註..."
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    {/* Row 6: 庫存, 安全庫存 */}
                    <div className="flex gap-3 flex-wrap mb-4">
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '120px' }}>
                            <label className={styles.label}>{t('pim.thStock')}</label>
                            <input ref={stockInputRef} disabled={!isEditing} type="number" className={styles.input} value={formData.stock || 0} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '120px' }}>
                            <label className={styles.label}>{t('pim.safetyStock')}</label>
                            <input
                                ref={safetyStockInputRef}
                                disabled={!isEditing}
                                type="number"
                                className={styles.input}
                                value={formData.safety_stock || 0}
                                onKeyDown={(e) => handleEnterFocusByRef(e, { nextRef: baseCostInputRef, prevRef: stockInputRef })}
                                onChange={(e) => setFormData({ ...formData, safety_stock: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    {/* Row 7: 基礎進價 */}
                    <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                        <label className={styles.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {t('pim.thCost')}
                            <button type="button" data-enter-nav-skip="true" className="text-muted hover:text-primary transition" onClick={(e) => { e.preventDefault(); setShowBaseCost(!showBaseCost); }}>
                                {showBaseCost ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </label>
                        <input
                            ref={baseCostInputRef}
                            disabled={!isEditing}
                            type={showBaseCost ? "number" : "password"}
                            className={styles.input}
                            value={formData.base_cost !== undefined ? formData.base_cost : ''}
                            onKeyDown={(e) => handleEnterFocusByRef(e, { nextRef: priceAInputRef, prevRef: safetyStockInputRef })}
                            onChange={(e) => setFormData({ ...formData, base_cost: parseInt(e.target.value) || 0 })}
                        />
                    </div>

                    {/* Row 8: 售價A, 售價B, 售價C */}
                    <div className="flex gap-3 flex-wrap mb-6 border-b border-border-color pb-6">
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '100px' }}>
                            <label className={styles.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {t('pim.thPriceA')}
                                <button type="button" data-enter-nav-skip="true" className="text-muted hover:text-primary transition" onClick={(e) => { e.preventDefault(); setShowSalesPrices(!showSalesPrices); }}>
                                    {showSalesPrices ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </label>
                            <input ref={priceAInputRef} disabled={!isEditing} type={showSalesPrices ? "number" : "password"} className={`${styles.input} bg-bg-tertiary text-accent-primary font-bold ${isEditing ? 'bg-bg-primary' : ''}`} value={formData.price_a !== undefined ? formData.price_a : ''} onChange={(e) => setFormData({ ...formData, price_a: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '100px' }}>
                            <label className={styles.label}>{t('pim.thPriceB')}</label>
                            <input disabled={!isEditing} type={showSalesPrices ? "number" : "password"} className={`${styles.input} bg-bg-tertiary text-success font-bold ${isEditing ? 'bg-bg-primary' : ''}`} value={formData.price_b !== undefined ? formData.price_b : ''} onChange={(e) => setFormData({ ...formData, price_b: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1, minWidth: '100px' }}>
                            <label className={styles.label}>{t('pim.thPriceC')}</label>
                            <input disabled={!isEditing} type={showSalesPrices ? "number" : "password"} className={`${styles.input} bg-bg-tertiary text-warning font-bold ${isEditing ? 'bg-bg-primary' : ''}`} value={formData.price_c !== undefined ? formData.price_c : ''} onChange={(e) => setFormData({ ...formData, price_c: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>

                    {/* 適用車型料號 */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>{t('pim.drawerPartsMap')}</div>
                        <div className="flex-col gap-3">
                            {(p.part_numbers || []).length > 0 && (
                                <div className="flex gap-2 items-center px-3 py-2 text-xs font-bold text-[#60a5fa] bg-[#3b82f622] rounded-md mb-[-4px]">
                                    <div style={{ flex: 3, minWidth: '100px', display: 'flex', alignItems: 'center', paddingLeft: '24px' }}>適用號碼</div>
                                    <div style={{ flex: 2, minWidth: '80px' }}>車種</div>
                                    <div style={{ flex: 1, minWidth: '60px' }}>年份</div>
                                    <div style={{ flex: 1, minWidth: '60px' }}>品牌</div>
                                    <div style={{ flex: 2, minWidth: '80px' }}>品名規格</div>
                                    <div style={{ flex: 3, minWidth: '100px' }}>備註</div>
                                    {isEditing && <div style={{ width: '20px', flexShrink: 0 }} />}
                                </div>
                            )}
                            {(p.part_numbers || []).map((pn, i) => (
                                <div key={pn.pn_id} className="flex gap-2 items-center p-2 bg-bg-secondary border border-border-color rounded-md overflow-x-auto text-sm w-full">
                                    <div style={{ flex: 3, minWidth: '100px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            className="text-secondary hover:text-primary transition shrink-0 bg-transparent border-0 p-0 m-0 cursor-pointer"
                                            style={{ display: 'flex', alignItems: 'center' }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleCopy(pn.part_number);
                                            }}
                                            title="複製料號"
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <input
                                            disabled={!isEditing}
                                            className={styles.input}
                                            style={{ width: '100%' }}
                                            ref={(el) => {
                                                if (!pn?.pn_id) return;
                                                if (el) {
                                                    partNumberInputRefs.current[pn.pn_id] = el;
                                                } else {
                                                    delete partNumberInputRefs.current[pn.pn_id];
                                                }
                                            }}
                                            placeholder="料號"
                                            value={pn.part_number || ''}
                                            onChange={(e) => {
                                                const newParts = [...(formData.part_numbers || [])];
                                                newParts[i].part_number = e.target.value;
                                                setFormData({ ...formData, part_numbers: newParts });
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 2, minWidth: '80px' }}>
                                        <AutocompleteInput
                                            value={pn.car_model || ''}
                                            onChange={(val) => {
                                                const newParts = [...(formData.part_numbers || [])];
                                                newParts[i].car_model = val;
                                                setFormData({ ...formData, part_numbers: newParts });
                                            }}
                                            placeholder="車型"
                                            data={models}
                                            filterKey="shorthand"
                                            labelKey="fullname"
                                            required={false}
                                            compact={true}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '60px' }}>
                                        <input
                                            disabled={!isEditing}
                                            className={`${styles.input} w-full`}
                                            placeholder="年份"
                                            value={pn.year || ''}
                                            onChange={(e) => {
                                                const newParts = [...(formData.part_numbers || [])];
                                                newParts[i].year = e.target.value;
                                                setFormData({ ...formData, part_numbers: newParts });
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '60px' }}>
                                        <AutocompleteInput
                                            value={pn.brand || ''}
                                            onChange={(val) => {
                                                const newParts = [...(formData.part_numbers || [])];
                                                newParts[i].brand = val;
                                                setFormData({ ...formData, part_numbers: newParts });
                                            }}
                                            placeholder="品牌"
                                            data={brands}
                                            filterKey="shorthand"
                                            labelKey="fullname"
                                            required={false}
                                            compact={true}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div style={{ flex: 2, minWidth: '80px' }}>
                                        <input
                                            disabled={!isEditing}
                                            className={`${styles.input} w-full`}
                                            placeholder="品名規格"
                                            value={pn.name_spec || ''}
                                            onChange={(e) => {
                                                const newParts = [...(formData.part_numbers || [])];
                                                newParts[i].name_spec = e.target.value;
                                                setFormData({ ...formData, part_numbers: newParts });
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 3, minWidth: '100px' }}>
                                        <input
                                            disabled={!isEditing}
                                            className={`${styles.input} w-full`}
                                            placeholder="備註"
                                            value={pn.note || ''}
                                            onChange={(e) => {
                                                const newParts = [...(formData.part_numbers || [])];
                                                newParts[i].note = e.target.value;
                                                setFormData({ ...formData, part_numbers: newParts });
                                            }}
                                        />
                                    </div>
                                    {isEditing && (
                                        <button className="text-secondary hover:text-danger shrink-0 ml-1" onClick={() => {
                                            const newParts = (formData.part_numbers || []).filter((_, idx) => idx !== i);
                                            setFormData({ ...formData, part_numbers: newParts });
                                        }}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {isEditing && (
                                <button className="flex items-center gap-2 justify-center py-2 text-sm text-accent-hover bg-accent-subtle rounded-md hover:bg-accent-primary hover:text-white transition"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddPartNumberRow();
                                        }
                                    }}
                                    onClick={handleAddPartNumberRow}>
                                    <CopyPlus size={16} /> 新增適用車型料號
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 實體照片建檔 */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {t('pim.drawerGallery')}
                            <div className="flex items-center gap-2">
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleImageUpload} />
                                <button type="button" disabled={!isEditing} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition ${isEditing ? 'text-accent-hover bg-accent-subtle hover:bg-accent-primary hover:text-white' : 'text-muted bg-bg-tertiary cursor-not-allowed'}`} onClick={() => setShowUrlInput(!showUrlInput)}>
                                    URL新增
                                </button>
                                <button type="button" disabled={!isEditing} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition ${isEditing ? 'text-accent-hover bg-accent-subtle hover:bg-accent-primary hover:text-white' : 'text-muted bg-bg-tertiary cursor-not-allowed'}`} onClick={() => fileInputRef.current?.click()}>
                                    <Camera size={14} /> 上傳照片
                                </button>
                            </div>
                        </div>

                        {showUrlInput && isEditing && (
                            <div className="flex items-center gap-2 mt-2 mb-2 p-2 bg-bg-secondary rounded border border-border-color">
                                <input type="text" className={`${styles.input} flex-1`} placeholder="輸入網路圖片網址 (URL)..." value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} />
                                <button type="button" className="px-3 py-1 text-xs rounded bg-accent-primary text-white hover:opacity-90 transition" onClick={handleAddUrlImage}>新增</button>
                                <button type="button" className="px-2 py-1 text-xs rounded text-muted hover:text-primary transition" onClick={() => setShowUrlInput(false)}>取消</button>
                            </div>
                        )}

                        <div className="flex gap-2 flex-wrap mt-2">
                            {(p.images || []).map((img, idx) => (
                                <div key={idx} style={{ width: '80px', height: '80px', flexShrink: 0, position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setEnlargedImageIndex(idx); }}>
                                    {img.startsWith('blob:') || img.startsWith('http') || img.startsWith('data:') || img.startsWith('/api') ? (
                                        <img src={img} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', padding: '4px', wordBreak: 'break-all' }}>
                                            {img}
                                        </div>
                                    )}
                                    {isEditing && (
                                        <button type="button" style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--danger)', color: 'white', borderRadius: '50%', padding: '2px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 10 }} onClick={(e) => {
                                            e.stopPropagation();
                                            const newImages = [...formData.images];
                                            newImages.splice(idx, 1);
                                            setFormData({ ...formData, images: newImages });
                                        }} title="刪除照片">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {(p.images || []).length === 0 && (
                                <div className="text-xs text-muted italic p-2">{t('pim.drawerNoImg')}</div>
                            )}
                        </div>
                    </div>

                </div>
                </>
                )}
            </div>

            {enlargedImageIndex !== null && hasData && (p?.images || [])[enlargedImageIndex] && (
                <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 anim-fade-in" onClick={(e) => { e.stopPropagation(); setEnlargedImageIndex(null); }}>
                    <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img src={(p.images || [])[enlargedImageIndex]} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} alt="Enlarged" className="rounded shadow-2xl" />
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full">
                            ← / → 切換照片
                        </div>
                        <button className="absolute -top-10 right-0 text-white hover:text-accent-primary p-2 bg-black/50 rounded-full transition" onClick={(e) => { e.stopPropagation(); setEnlargedImageIndex(null); }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDrawer;
