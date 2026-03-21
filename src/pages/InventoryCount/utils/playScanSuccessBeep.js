/**
 * 掃碼成功時播放短促嗶聲（Web Audio，無需音檔）。
 * 部分瀏覽器需使用者曾與頁面互動後才可播放。
 */
let sharedCtx = null;

export function playScanSuccessBeep() {
    if (typeof window === 'undefined') return;

    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;

        if (!sharedCtx) {
            sharedCtx = new AC();
        }
        const ctx = sharedCtx;

        const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
        resume.catch(() => {});

        const t0 = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t0);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

        osc.start(t0);
        osc.stop(t0 + 0.12);
    } catch {
        /* 忽略不支援或權限問題 */
    }
}
