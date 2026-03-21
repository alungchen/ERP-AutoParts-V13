import React, { useCallback, useId, useRef, useState } from 'react';
import ScannerPanel from '../components/ScannerPanel';
import CameraPermissionHint from '../components/CameraPermissionHint';
import { useHtml5QrcodeScanner } from '../hooks/useHtml5QrcodeScanner';
import { playScanSuccessBeep, unlockAudioContext } from '../utils/playScanSuccessBeep';
import styles from './ScanSessionView.module.css';

const DEBOUNCE_MS = 1400;

const ScanSessionView = ({ sheetTitle, onScanText }) => {
    const readerId = useId().replace(/:/g, '');
    const [camFailed, setCamFailed] = useState(false);
    const [camError, setCamError] = useState('');
    const [feedback, setFeedback] = useState({ type: 'muted', text: '相機就緒後請對準條碼。' });
    const [soundHintOpen, setSoundHintOpen] = useState(false);
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
                void playScanSuccessBeep();
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

            <div className={styles.soundBar}>
                <button
                    type="button"
                    className={styles.soundTestBtn}
                    onClick={async () => {
                        await unlockAudioContext();
                        await playScanSuccessBeep();
                    }}
                >
                    試播嗶聲（解鎖音效）
                </button>
                <button
                    type="button"
                    className={styles.soundHintToggle}
                    onClick={() => setSoundHintOpen((v) => !v)}
                    aria-expanded={soundHintOpen}
                >
                    {soundHintOpen ? '收合' : '沒聲音？手機設定檢查'}
                </button>
            </div>

            {soundHintOpen ? (
                <div className={styles.soundHintBox}>
                    <p className={styles.soundHintTitle}>掃碼成功嗶聲需同時滿足：</p>
                    <ul className={styles.soundHintList}>
                        <li>
                            <strong>先點一次「試播嗶聲」</strong>
                            ：iPhone／部分 Android 規定網頁音效須經<strong>手指點按</strong>解鎖，相機自動解碼不算手勢，故可能無聲。
                        </li>
                        <li>
                            <strong>iPhone</strong>
                            ：側邊<strong>靜音開關</strong>請關閉（非靜音）；用側鍵或控制中心調高<strong>鈴聲／媒體音量</strong>。
                        </li>
                        <li>
                            <strong>Android</strong>
                            ：媒體音量勿為 0；Chrome 選單 → 網站設定 → 確認未封鎖<strong>音效</strong>。
                        </li>
                        <li>
                            <strong>仍無聲</strong>
                            ：改用 Chrome／Safari 最新版；部分內嵌瀏覽器（如 LINE 內建）會限制音效。
                        </li>
                    </ul>
                </div>
            ) : null}

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
