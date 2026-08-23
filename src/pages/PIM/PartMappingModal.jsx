import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../i18n';
import styles from './ProductList.module.css';

const PartMappingModal = ({ product, activeSearchTerms, onClose }) => {
    const { t } = useTranslation();
    const [copiedId, setCopiedId] = useState(null);
    const [localProduct, setLocalProduct] = useState(product);
    const [selectedMainPnId, setSelectedMainPnId] = useState(() => {
        const mainPart = product?.part_numbers?.find((pn) => pn.is_main);
        return mainPart?.pn_id ?? product?.part_numbers?.[0]?.pn_id ?? null;
    });

    React.useEffect(() => {
        setLocalProduct(product);
        const mainPart = product?.part_numbers?.find((pn) => pn.is_main);
        setSelectedMainPnId(mainPart?.pn_id ?? product?.part_numbers?.[0]?.pn_id ?? null);
    }, [product]);

    const handleSelectMainPart = (pnId) => {
        setSelectedMainPnId(pnId);
        setLocalProduct((prev) => ({
            ...prev,
            part_numbers: (prev?.part_numbers || []).map((pn) => ({
                ...pn,
                is_main: pn.pn_id === pnId
            }))
        }));
    };

    const handleCopy = (text, id) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        } else {
            // Fallback for older browsers or non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        }
    };

    if (!product) return null;

    const currentMainPart = (localProduct?.part_numbers || []).find((pn) => pn.pn_id === selectedMainPnId) || (localProduct?.part_numbers || [])[0] || {};

    // We generate the mapping rows from product.part_numbers
    // In actual use cases, each map entry might have its own specific car model / year
    // Here we use product's car_models for display purposes or leave blank if unspecified per part

    return (
        <div className={styles.modalOverlay} onClick={onClose} style={{ zIndex: 1000, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', width: '90%', maxWidth: '1200px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div className={styles.modalHeader} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
                    <div>
                        <div className="text-sm text-secondary font-bold">{t('pim.mappingModalTitle')}</div>
                        <div className="text-lg font-bold">
                            {t('pim.thProductName')}: {product.name}
                        </div>
                    </div>
                    <button className={styles.btnSecondary} onClick={onClose} style={{ padding: '0.5rem', border: 'none', background: 'transparent' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.modalBody} style={{ overflowY: 'auto', padding: '1rem', flex: 1 }}>
                    <div style={{ paddingBottom: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="text-sm flex items-center gap-2">
                            <span className="text-secondary font-bold">{t('pim.thPartNo')}:</span>
                            <span className="font-mono bg-tertiary px-2 py-1 rounded flex items-center gap-2">
                                {product.p_id}
                                <button
                                    className="text-secondary hover:text-primary transition shrink-0 bg-transparent border-0 p-0 m-0 cursor-pointer"
                                    onClick={() => handleCopy(product.p_id, 'p_id')}
                                    style={{ color: copiedId === 'p_id' ? '#10b981' : 'inherit' }}
                                >
                                    {copiedId === 'p_id' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </span>
                        </div>
                        <div className="text-sm flex items-center gap-2">
                            <span className="text-secondary font-bold">自編號碼:</span>
                            <span className="font-mono bg-tertiary px-2 py-1 rounded flex items-center gap-2">
                                {currentMainPart.part_number || product.part_numbers[0]?.part_number || '-'}
                                {(currentMainPart.part_number || product.part_numbers[0]?.part_number) && (
                                    <button
                                        className="text-secondary hover:text-primary transition shrink-0 bg-transparent border-0 p-0 m-0 cursor-pointer"
                                        onClick={() => handleCopy(currentMainPart.part_number || product.part_numbers[0].part_number, 'main_pn')}
                                        style={{ color: copiedId === 'main_pn' ? '#10b981' : 'inherit' }}
                                    >
                                        {copiedId === 'main_pn' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                )}
                            </span>
                        </div>
                        <div className="text-sm flex items-center gap-2">
                            <span className="text-secondary font-bold">主要顯示:</span>
                            <span className="font-mono bg-tertiary px-2 py-1 rounded">
                                {currentMainPart.part_number || '-'}
                            </span>
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>
                            <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                <tr>
                                    <th style={{ width: '52px', textAlign: 'center', padding: '0.75rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>主顯示</th>
                                    <th style={{ width: '40px', textAlign: 'center', padding: '0.75rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>#</th>
                                    <th style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thAppNumber')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thVehicle')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thYear')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thBrand')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thProdSpec')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thNotes')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(localProduct?.part_numbers || []).map((pn, idx) => {
                                    let isMatch = false;
                                    if (activeSearchTerms) {
                                        if (activeSearchTerms.model && (pn.car_model || '').toLowerCase().includes(activeSearchTerms.model.toLowerCase())) isMatch = true;
                                        if (activeSearchTerms.partNumber && (pn.part_number || '').toLowerCase().includes(activeSearchTerms.partNumber.toLowerCase())) isMatch = true;
                                        if (activeSearchTerms.brand && (pn.brand || '').toLowerCase().includes(activeSearchTerms.brand.toLowerCase())) isMatch = true;
                                        if (activeSearchTerms.year && (pn.year || '').includes(activeSearchTerms.year)) isMatch = true;
                                        if (activeSearchTerms.part && (pn.note || '').toLowerCase().includes(activeSearchTerms.part.toLowerCase())) isMatch = true;
                                    }

                                    const isSelectedMain = selectedMainPnId === pn.pn_id;

                                    return (
                                        <tr key={pn.pn_id} style={{ 
                                            borderBottom: '1px solid var(--border-color)', 
                                            background: isSelectedMain ? 'rgba(16, 185, 129, 0.10)' : (isMatch ? 'var(--accent-subtle)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)')),
                                            boxShadow: isSelectedMain ? 'inset 0 0 0 2px rgba(16,185,129,0.9)' : (isMatch ? 'inset 0 0 0 2px var(--accent-primary)' : 'none')
                                        }}>
                                        <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                                            <input
                                                type="checkbox"
                                                checked={isSelectedMain}
                                                onChange={() => handleSelectMainPart(pn.pn_id)}
                                                aria-label={`選擇 ${pn.part_number || '適用料號'} 作為主要顯示資料`}
                                                style={{ accentColor: '#10b981', width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '500', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>{idx + 1}</td>
                                        <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    className="text-secondary hover:text-primary transition shrink-0 bg-transparent border-0 p-0 m-0 cursor-pointer"
                                                    style={{ display: 'flex', alignItems: 'center', color: copiedId === pn.pn_id ? '#10b981' : 'inherit' }}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleCopy(pn.part_number, pn.pn_id);
                                                    }}
                                                    title="複製號碼"
                                                >
                                                    {copiedId === pn.pn_id ? <Check size={16} /> : <Copy size={16} />}
                                                </button>
                                                <span style={{ fontFamily: 'monospace', color: 'var(--accent-hover)' }}>{pn.part_number}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)' }}>{(() => {
                                            if (pn.car_model) return pn.car_model;
                                            const c = (localProduct?.car_models || [])[idx] || (localProduct?.car_models || [])[0];
                                            return typeof c === 'string' ? c : (c?.model || '-');
                                        })()}</td>
                                        <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)' }}>{pn.year || '-'}</td>
                                        <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)' }}>{pn.brand || '-'}</td>
                                        <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)' }}>{pn.name_spec || '-'}</td>
                                        <td style={{ padding: '0.75rem', border: '1px solid var(--border-color)' }}>{pn.note || '-'}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PartMappingModal;
