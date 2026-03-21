import React from 'react';
import styles from './ScannerPanel.module.css';

/** html5-qrcode 會在同一 id 的節點內插入 video／canvas */
const ScannerPanel = ({ containerId }) => (
    <div>
        <div className={styles.wrap}>
            <div id={containerId} className={styles.reader} />
            <div className={styles.overlay} aria-hidden>
                <div className={styles.frame} />
            </div>
        </div>
        <p className={styles.caption}>將條碼或 QR 對準框線；成功解碼後會自動累加該品項盤點量。</p>
    </div>
);

export default ScannerPanel;
