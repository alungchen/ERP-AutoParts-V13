import React from 'react';
import styles from './QuantityStepper.module.css';

const QuantityStepper = ({ value, onChange, min = 0, max = 999999, disabled }) => {
    const v = Number.isFinite(Number(value)) ? Number(value) : 0;

    const commit = (next) => {
        const n = Math.min(max, Math.max(min, Math.floor(next)));
        onChange(n);
    };

    return (
        <div className={styles.wrap}>
            <button
                type="button"
                className={styles.btn}
                disabled={disabled || v <= min}
                onClick={() => commit(v - 1)}
                aria-label="減少數量"
            >
                −
            </button>
            <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                disabled={disabled}
                value={String(v)}
                onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw === '') {
                        onChange(min);
                        return;
                    }
                    commit(Number(raw));
                }}
                onBlur={() => commit(v)}
                aria-label="盤點數量"
            />
            <button
                type="button"
                className={styles.btn}
                disabled={disabled || v >= max}
                onClick={() => commit(v + 1)}
                aria-label="增加數量"
            >
                +
            </button>
        </div>
    );
};

export default QuantityStepper;
