import React from 'react';
import styles from './CameraPermissionHint.module.css';

const CameraPermissionHint = ({ message }) => (
    <div className={styles.box} role="alert">
        <p className={styles.title}>無法啟用相機</p>
        <p style={{ margin: '0 0 0.5rem' }}>
            {message || '請確認已允許瀏覽器使用相機，並在 HTTPS 或本機環境下操作。'}
        </p>
        <ul className={styles.list}>
            <li>手機建議使用 Chrome 或 Safari，並檢查網址列權限圖示。</li>
            <li>若仍無法掃描，請回到上一頁使用「手動輸入條碼／料號」。</li>
        </ul>
    </div>
);

export default CameraPermissionHint;
