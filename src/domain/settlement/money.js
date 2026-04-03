/** 金額一律以「分」(minor) 儲存，避免浮點誤差 */

export function toMinorFromTwd(twd) {
    const n = Number(twd);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
}

export function toTwdFromMinor(minor) {
    if (!Number.isFinite(minor)) return 0;
    return minor / 100;
}

export function sumMinor(values) {
    return values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}
