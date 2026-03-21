import { useEffect, useRef } from 'react';

/**
 * 使用 html5-qrcode 啟用後鏡頭掃描。
 * @param {object} opts
 * @param {string} opts.containerId 掛載預覽的 DOM 元素 id（需已存在）
 * @param {boolean} opts.enabled
 * @param {(text: string) => void} opts.onDecode
 * @param {(err: Error | null) => void} [opts.onError]
 */
export function useHtml5QrcodeScanner({ containerId, enabled, onDecode, onError }) {
    const onDecodeRef = useRef(onDecode);
    const onErrorRef = useRef(onError);
    const instanceRef = useRef(null);
    onDecodeRef.current = onDecode;
    onErrorRef.current = onError;

    useEffect(() => {
        if (!enabled || !containerId) {
            return undefined;
        }

        let cancelled = false;

        const run = async () => {
            const mod = await import('html5-qrcode');
            const { Html5Qrcode } = mod;
            if (cancelled) return;

            const el = document.getElementById(containerId);
            if (!el) {
                onErrorRef.current?.(new Error('找不到掃碼容器'));
                return;
            }

            try {
                const instance = new Html5Qrcode(containerId);
                instanceRef.current = instance;
                await instance.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                            const size = Math.floor(minEdge * 0.72);
                            return { width: size, height: size };
                        },
                    },
                    (decodedText) => {
                        if (cancelled) return;
                        onDecodeRef.current?.(decodedText);
                    },
                    () => {}
                );
                if (cancelled) return;
                onErrorRef.current?.(null);
            } catch (e) {
                if (!cancelled) {
                    onErrorRef.current?.(e instanceof Error ? e : new Error(String(e)));
                }
            }
        };

        run();

        return () => {
            cancelled = true;
            const instance = instanceRef.current;
            instanceRef.current = null;
            if (!instance) return;
            instance
                .stop()
                .then(() => instance.clear())
                .catch(() => {});
        };
    }, [containerId, enabled]);
}
