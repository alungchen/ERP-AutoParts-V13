import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../i18n';
import styles from './ProductList.module.css';

const PartMappingModal = ({ product, onClose }) => {
    const { t } = useTranslation();
    const [copiedId, setCopiedId] = useState(null);

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
                    <div style={{ paddingBottom: '1rem', display: 'flex', gap: '2rem' }}>
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
                                {product.part_numbers[0]?.part_number || '-'}
                                {product.part_numbers[0]?.part_number && (
                                    <button
                                        className="text-secondary hover:text-primary transition shrink-0 bg-transparent border-0 p-0 m-0 cursor-pointer"
                                        onClick={() => handleCopy(product.part_numbers[0].part_number, 'main_pn')}
                                        style={{ color: copiedId === 'main_pn' ? '#10b981' : 'inherit' }}
                                    >
                                        {copiedId === 'main_pn' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                )}
                            </span>
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thAppNumber')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thVehicle')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thYear')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thProdSpec')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thBrand')}</th>
                                    <th style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pim.thNotes')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.part_numbers.map((pn, idx) => (
                                    <tr key={pn.pn_id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)' }}>
                                        <td style={{ padding: '0.75rem' }}>
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
                                        <td style={{ padding: '0.75rem' }}>{(() => {
                                            if (pn.car_model) return pn.car_model;
                                            const c = (product.car_models || [])[idx] || (product.car_models || [])[0];
                                            return typeof c === 'string' ? c : (c?.model || '-');
                                        })()}</td>
                                        <td style={{ padding: '0.75rem' }}>{pn.year || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{product.specifications || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{pn.brand || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{pn.note || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PartMappingModal;
