import React, { useCallback, useId, useRef, useState } from 'react';
import ScannerPanel from '../components/ScannerPanel';
import CameraPermissionHint from '../components/CameraPermissionHint';
import { useHtml5QrcodeScanner } from '../hooks/useHtml5QrcodeScanner';
import { playScanSuccessBeep } from '../utils/playScanSuccessBeep';
import styles from './ScanSessionView.module.css';

const DEBOUNCE_MS = 1400;

const ScanSessionView = ({ sheetTitle, onScanText }) => {
    const readerId = useId().replace(/:/g, '');
    const [camFailed, setCamFailed] = useState(false);
    const [camError, setCamError] = useState('');
    const [feedback, setFeedback] = useState({ type: 'muted', text: '相機就緒後請對準條碼。' });
    const lastRef = useRef({ code: '', t: 0 });

    const handleDecode = useCallback(
        (text) => {
            const now = Date.now();
            const raw = String(text || '').trim();
            if (!raw) return;
            if (lastRef.current.code === raw && now - lastRef.current.t < DEBOUNCE_MS) {
                return;
            }
            lastRef.current = { code: raw, t: now };

            const result = onScanText(raw);
            if (result?.ok) {
                playScanSuccessBeep();
                setFeedback({
                    type: 'ok',
                    text: `已掃描：${result.label || raw}（+1）`,
                });
            } else {
                setFeedback({
                    type: 'err',
                    text: '查無對應條碼或料號，請確認為本盤點單明細。',
                });
            }
        },
        [onScanText]
    );

    useHtml5QrcodeScanner({
        containerId: readerId,
        enabled: !camFailed,
        onDecode: handleDecode,
        onError: (err) => {
            if (err) {
                setCamFailed(true);
                setCamError(err.message || String(err));
            } else {
                setCamFailed(false);
                setCamError('');
            }
        },
    });

    return (
        <div>
            {sheetTitle ? (
                <p className={styles.sheetLabel} style={{ marginBottom: '1rem' }}>
                    {sheetTitle}
                </p>
            ) : null}

            {camFailed ? (
                <CameraPermissionHint message={camError} />
            ) : (
                <ScannerPanel containerId={readerId} />
            )}

            <p
                className={`${styles.feedback} ${
                    feedback.type === 'ok'
                        ? styles.feedbackOk
                        : feedback.type === 'err'
                          ? styles.feedbackErr
                          : styles.feedbackMuted
                }`}
                role="status"
            >
                {feedback.text}
            </p>
        </div>
    );
};

export default ScanSessionView;
