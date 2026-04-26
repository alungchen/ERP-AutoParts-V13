import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmModal - 自訂確認對話框，取代 window.confirm
 *
 * Props:
 *   open       {boolean}  - 是否顯示
 *   title      {string}   - 標題
 *   message    {string}   - 說明文字
 *   onConfirm  {function} - 點確認後執行
 *   onCancel   {function} - 點取消後執行
 *   danger     {boolean}  - 是否用紅色危險樣式（default true）
 *   confirmLabel {string} - 確認按鈕文字（default '確認刪除'）
 *   cancelLabel  {string} - 取消按鈕文字（default '取消'）
 */
const ConfirmModal = ({
    open,
    title = '確認操作',
    message,
    onConfirm,
    onCancel,
    danger = true,
    confirmLabel = '確認刪除',
    cancelLabel = '取消',
}) => {
    if (!open) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(2px)',
            }}
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--bg-secondary, #1e293b)',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: '16px',
                    padding: '2rem',
                    maxWidth: '420px',
                    width: '90vw',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    animation: 'fadeInScale 0.15s ease',
                }}
            >
                {/* Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <AlertTriangle size={20} color={danger ? '#ef4444' : '#3b82f6'} />
                    </div>
                    <span style={{
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        color: 'var(--text-primary, #f1f5f9)',
                    }}>
                        {title}
                    </span>
                </div>

                {/* Message */}
                {message && (
                    <p style={{
                        margin: 0,
                        color: 'var(--text-secondary, #94a3b8)',
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                    }}>
                        {message}
                    </p>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #334155)',
                            background: 'var(--bg-tertiary, #0f172a)',
                            color: 'var(--text-secondary, #94a3b8)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                        }}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: danger ? '#ef4444' : '#3b82f6',
                            color: 'white',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.92); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default ConfirmModal;
