/**
 * 掃碼成功時播放短促嗶聲（Web Audio，無需音檔）。
 * iOS / 部分 Android 須先經使用者點擊／觸控解鎖 AudioContext，請搭配「試播嗶聲」按鈕。
 */
let sharedCtx = null;

function getOrCreateContext() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx) {
        sharedCtx = new AC();
    }
    return sharedCtx;
}

/** 在使用者點按時呼叫，解鎖後掃碼回呼才能播音 */
export async function unlockAudioContext() {
    const ctx = getOrCreateContext();
    if (!ctx) return false;
    try {
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        return ctx.state === 'running';
    } catch {
        return false;
    }
}

/**
 * 播放成功嗶聲（內部會嘗試 resume，但若未先解鎖可能仍無聲）。
 */
export async function playScanSuccessBeep() {
    try {
        await unlockAudioContext();
        const ctx = getOrCreateContext();
        if (!ctx || ctx.state !== 'running') return;

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
        /* 忽略 */
    }
}
