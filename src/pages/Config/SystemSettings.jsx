import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_DISPLAY_MODE_CARD_ORDER, useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import { pullStoresFromD1 } from '../../lib/d1Bootstrap';
import { pushAllStoresToD1 } from '../../lib/erpPersistStorage';
import { apiUrl } from '../../lib/apiUrl';
import { Settings, Globe, CircleDollarSign, Database, LayoutPanelTop, ShieldCheck, LockKeyhole, Palette, CloudDownload, CloudUpload, Trash2, Layers } from 'lucide-react';

const DISPLAY_MODE_CARDS = {
    nightclub: {
        key: 'nightclub',
        title: '選項1：夜店風',
        desc: '深色高對比，適合長時間看螢幕與夜間作業。',
        swatches: ['#0A0A0B', '#0070F3', '#FF9500']
    },
    light: {
        key: 'light',
        title: '選項2：白底商務風',
        desc: '白底搭配藍灰字色，文件感更強，列印視覺更一致。',
        swatches: ['#ffffff', '#2563eb', '#16a34a']
    },
    warm: {
        key: 'warm',
        title: '選項3：暖白護眼風',
        desc: '米白底與暖棕重點色，降低刺眼感，閱讀更柔和。',
        swatches: ['#fffdf6', '#8b5e34', '#b7791f']
    },
    system: {
        key: 'system',
        title: '選項4：跟隨系統',
        desc: '自動依照 Windows 深色/淺色模式切換（深色=夜店風，淺色=白底商務風）。',
        swatches: ['#0A0A0B', '#f8fafc', '#2563eb']
    }
};

const SystemSettings = () => {
    const { t } = useTranslation();
    const {
        defaultCurrency, setDefaultCurrency,
        vatEnabled, setVatEnabled,
        vatRate, setVatRate,
        isMultiCountryMode, setMultiCountryMode,
        showImportExport, setShowImportExport,
        showBatchDelete, setShowBatchDelete,
        enablePermissionRole, setEnablePermissionRole,
        enableLoginSystem, setEnableLoginSystem,
        operationMode, setOperationMode,
        displayMode, setDisplayMode,
        displayModeCardOrder, setDisplayModeCardOrder
    } = useAppStore();
    const [draggingDisplayModeIndex, setDraggingDisplayModeIndex] = useState(null);
    const [pendingOperationMode, setPendingOperationMode] = useState(operationMode);
    const [systemThemeLabel, setSystemThemeLabel] = useState(() => (
        window.matchMedia('(prefers-color-scheme: dark)').matches ? '深色' : '淺色'
    ));
    const [dbSyncLoading, setDbSyncLoading] = useState(null);
    const [dbSyncMessage, setDbSyncMessage] = useState(null);

    useEffect(() => {
        setPendingOperationMode(operationMode);
    }, [operationMode]);

    const normalizedDisplayModeOrder = useMemo(() => [
        ...displayModeCardOrder.filter((k) => DEFAULT_DISPLAY_MODE_CARD_ORDER.includes(k)),
        ...DEFAULT_DISPLAY_MODE_CARD_ORDER.filter((k) => !displayModeCardOrder.includes(k)),
    ], [displayModeCardOrder]);

    const displayModesInOrder = useMemo(
        () => normalizedDisplayModeOrder.map((k) => DISPLAY_MODE_CARDS[k]).filter(Boolean),
        [normalizedDisplayModeOrder]
    );

    const handleDisplayModeCardDragStart = (e, index) => {
        setDraggingDisplayModeIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDisplayModeCardDragOver = (e, index) => {
        e.preventDefault();
        if (draggingDisplayModeIndex === null || draggingDisplayModeIndex === index) return;
        const next = [...normalizedDisplayModeOrder];
        const dragged = next[draggingDisplayModeIndex];
        next.splice(draggingDisplayModeIndex, 1);
        next.splice(index, 0, dragged);
        setDraggingDisplayModeIndex(index);
        setDisplayModeCardOrder(next);
    };

    const handleDisplayModeCardDragEnd = () => {
        setDraggingDisplayModeIndex(null);
    };

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateThemeLabel = () => setSystemThemeLabel(mediaQuery.matches ? '深色' : '淺色');
        updateThemeLabel();
        mediaQuery.addEventListener('change', updateThemeLabel);
        return () => mediaQuery.removeEventListener('change', updateThemeLabel);
    }, []);

    const handleSaveOperationMode = () => {
        if (pendingOperationMode === operationMode) return;
        setOperationMode(pendingOperationMode);
        // Refresh to matching layout state immediately
        window.location.href = '/settings';
    };

    const apiBaseHint = import.meta.env.VITE_API_BASE
        ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')
        : '（同網域，經 /api 代理）';

    const handlePullFromCloud = async () => {
        if (
            !window.confirm(
                '將從雲端 D1 讀取快照，並覆寫本機瀏覽器中已對應的資料。\n未在雲端出現的 store 欄位會保留本機值。\n是否繼續？'
            )
        ) {
            return;
        }
        setDbSyncMessage(null);
        setDbSyncLoading('pull');
        try {
            const result = await pullStoresFromD1();
            if (result.empty) {
                setDbSyncMessage('雲端尚無快照資料，本機未變更。');
            } else {
                setDbSyncMessage(`已從雲端套用 ${result.updatedKeys} 個 store，畫面已重新載入狀態。`);
            }
        } catch (e) {
            setDbSyncMessage(`下載失敗：${e?.message || String(e)}`);
        } finally {
            setDbSyncLoading(null);
        }
    };

    const handlePushToCloud = async () => {
        if (
            !window.confirm(
                '將把本機目前所有已儲存的 Zustand 快照寫入雲端 D1，可能覆寫雲端現有內容。\n是否繼續？'
            )
        ) {
            return;
        }
        setDbSyncMessage(null);
        setDbSyncLoading('push');
        try {
            const data = await pushAllStoresToD1();
            if (data?.skipped) {
                setDbSyncMessage('本機尚無可上傳的 store 資料。');
                return;
            }
            const saved = data?.saved ?? data?.count;
            setDbSyncMessage(
                typeof saved === 'number'
                    ? `已上傳至雲端（寫入 ${saved} 筆 store 列）。`
                    : '已上傳至雲端。'
            );
        } catch (e) {
            setDbSyncMessage(`上傳失敗：${e?.message || String(e)}`);
        } finally {
            setDbSyncLoading(null);
        }
    };

    const switchTrackStyle = {
        width: '46px',
        height: '26px',
        borderRadius: '999px',
        position: 'relative',
        transition: 'all 0.2s ease',
        border: '1px solid #475569',
    };

    const switchThumbStyle = {
        content: "''",
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'all 0.2s ease',
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.8rem' }}>
                    <Settings size={32} /> {t('sidebar.config')}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>管理 ERP 全域基礎設定與交易模組行為</p>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
                {/* Multi-country Mode */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Globe className="text-accent-primary" />
                            <div>
                                <div style={{ fontWeight: 800 }}>多國/跨境模式開關</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    關閉後將隱藏「國家地區」相關顯示，簡化操作介面。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMultiCountryMode(!isMultiCountryMode)}
                            style={{ ...switchTrackStyle, background: isMultiCountryMode ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: isMultiCountryMode ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Import/Export & Batch Delete Features */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Database className="text-success" />
                            <div>
                                <div style={{ fontWeight: 800 }}>匯出 / 匯入 功能開啟</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後將在產品、夥伴及採購頁面顯示數據移動按鈕。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowImportExport(!showImportExport)}
                            style={{ ...switchTrackStyle, background: showImportExport ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: showImportExport ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>

                    <div style={{ width: '100%', height: '1px', background: 'var(--border-color)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Layers className="text-danger" color="#ef4444" />
                            <div>
                                <div style={{ fontWeight: 800 }}>批次刪除 功能開啟</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後將在產品資料庫頁面顯示批次刪除按鈕。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowBatchDelete(!showBatchDelete)}
                            style={{ ...switchTrackStyle, background: showBatchDelete ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: showBatchDelete ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* D1 資料庫同步 */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <Database className="text-accent-primary" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800 }}>資料庫同步（Cloudflare D1）</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: '0.75rem' }}>
                                手動與雲端 D1 同步 Zustand 快照（各模組的 localStorage 持久化資料）。此流程<strong>不經 Git</strong>；若前端與 API 不同網域，請在部署環境設定{' '}
                                <code style={{ fontSize: '0.8rem' }}>VITE_API_BASE</code>。
                                圖檔等 R2 物件仍依各頁面上傳流程，不在此同步。
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', wordBreak: 'break-all' }}>
                                API：{apiUrl('/api/stores')} · 基址 {apiBaseHint}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    disabled={!!dbSyncLoading}
                                    onClick={handlePullFromCloud}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.85rem',
                                        fontWeight: 700,
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        cursor: dbSyncLoading ? 'not-allowed' : 'pointer',
                                        opacity: dbSyncLoading ? 0.65 : 1,
                                    }}
                                >
                                    <CloudDownload size={18} />
                                    {dbSyncLoading === 'pull' ? '下載中…' : '從雲端下載至本機'}
                                </button>
                                <button
                                    type="button"
                                    disabled={!!dbSyncLoading}
                                    onClick={handlePushToCloud}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.85rem',
                                        fontWeight: 700,
                                        background: 'var(--accent-primary)',
                                        color: '#fff',
                                        cursor: dbSyncLoading ? 'not-allowed' : 'pointer',
                                        opacity: dbSyncLoading ? 0.65 : 1,
                                    }}
                                >
                                    <CloudUpload size={18} />
                                    {dbSyncLoading === 'push' ? '上傳中…' : '將本機上傳至雲端'}
                                </button>
                            </div>
                            {dbSyncMessage && (
                                <div
                                    style={{
                                        marginTop: '0.85rem',
                                        fontSize: '0.88rem',
                                        color: dbSyncMessage.startsWith('下載失敗') || dbSyncMessage.startsWith('上傳失敗')
                                            ? '#f87171'
                                            : 'var(--text-secondary)',
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {dbSyncMessage}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Local Currency Setting */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <CircleDollarSign className="text-warning" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>系統預設交易幣別</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                設定本公司當地交易使用的主要貨幣 (如 TWD, USD, CNY)。
                            </div>
                            <select
                                value={defaultCurrency}
                                onChange={e => setDefaultCurrency(e.target.value)}
                                style={{
                                    padding: '0.6rem 1rem',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    width: '140px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="TWD">TWD (NTD)</option>
                                <option value="USD">USD</option>
                                <option value="JPY">JPY</option>
                                <option value="CNY">CNY</option>
                                <option value="EUR">EUR</option>
                                <option value="HKD">HKD</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Display Mode */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <Palette className="text-accent-primary" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>顯示模式</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.35rem' }}>
                                依照操作環境切換整體配色，立即生效。
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                                字卡可拖曳調整順序（會一併儲存於此瀏覽器）。
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.55rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setDisplayModeCardOrder([...DEFAULT_DISPLAY_MODE_CARD_ORDER])}
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-secondary)',
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    重設字卡順序
                                </button>
                            </div>
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                                {displayModesInOrder.map((mode, cardIndex) => {
                                    const active = displayMode === mode.key;
                                    return (
                                        <button
                                            key={mode.key}
                                            type="button"
                                            draggable
                                            onDragStart={(e) => handleDisplayModeCardDragStart(e, cardIndex)}
                                            onDragOver={(e) => handleDisplayModeCardDragOver(e, cardIndex)}
                                            onDragEnd={handleDisplayModeCardDragEnd}
                                            title="拖曳以調整順序；點選套用顯示模式"
                                            onClick={() => setDisplayMode(mode.key)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '0.7rem 0.85rem',
                                                borderRadius: '8px',
                                                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                background: active ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)',
                                                cursor: 'grab',
                                                opacity: draggingDisplayModeIndex === cardIndex ? 0.65 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                                                <div style={{ fontWeight: 700 }}>{mode.title}</div>
                                                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                                                    {mode.swatches.map((color) => (
                                                        <span
                                                            key={`${mode.key}-${color}`}
                                                            style={{
                                                                width: '12px',
                                                                height: '12px',
                                                                borderRadius: '50%',
                                                                background: color,
                                                                border: '1px solid var(--border-color)',
                                                                display: 'inline-block'
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{mode.desc}</div>
                                            {mode.key === 'system' && (
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 700 }}>
                                                    目前：{systemThemeLabel}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Operation Mode */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <LayoutPanelTop className="text-accent-primary" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>操作模式</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.9rem' }}>
                                選擇左側選單點擊後的頁面開啟方式。
                            </div>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>選項1：傳統配置模式</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            左側選單切換時，維持單一內容區直接切頁。
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingOperationMode('current')}
                                        style={{ ...switchTrackStyle, background: pendingOperationMode === 'current' ? '#2563eb' : '#334155', flexShrink: 0 }}
                                    >
                                        <span style={{ ...switchThumbStyle, transform: pendingOperationMode === 'current' ? 'translateX(20px)' : 'translateX(0)' }} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>選項2：新分頁模式</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            點選左側六項任一功能時，開新分頁（顯示於原分頁旁）。
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingOperationMode('tabbed')}
                                        style={{ ...switchTrackStyle, background: pendingOperationMode === 'tabbed' ? '#2563eb' : '#334155', flexShrink: 0 }}
                                    >
                                        <span style={{ ...switchThumbStyle, transform: pendingOperationMode === 'tabbed' ? 'translateX(20px)' : 'translateX(0)' }} />
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={handleSaveOperationMode}
                                    disabled={pendingOperationMode === operationMode}
                                    style={{
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.55rem 1rem',
                                        fontWeight: 700,
                                        color: 'white',
                                        background: pendingOperationMode === operationMode ? 'var(--text-muted)' : 'var(--accent-primary)',
                                        cursor: pendingOperationMode === operationMode ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    儲存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* VAT Setting */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                            <CircleDollarSign className="text-accent-primary" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800 }}>VAT 設定</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.8rem' }}>
                                    可設定單據底部 VAT 稅率，並可隨時啟用/停用。預設為 5%。
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={vatRate}
                                        onChange={(e) => setVatRate(e.target.value)}
                                        style={{
                                            width: '120px',
                                            padding: '0.5rem 0.65rem',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '1rem',
                                            fontWeight: 700
                                        }}
                                    />
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>%</span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setVatEnabled(!vatEnabled)}
                            style={{ ...switchTrackStyle, background: vatEnabled ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: vatEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Permission Role Toggle */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <ShieldCheck className="text-warning" />
                            <div>
                                <div style={{ fontWeight: 800 }}>權限角色功能開關</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後可在員工資料中設定與顯示「權限角色」欄位。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEnablePermissionRole(!enablePermissionRole)}
                            style={{ ...switchTrackStyle, background: enablePermissionRole ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: enablePermissionRole ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Login System Toggle */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <LockKeyhole className="text-accent-primary" />
                            <div>
                                <div style={{ fontWeight: 800 }}>登入系統功能開關</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後系統需登入才可進入，並啟用權限角色控制。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEnableLoginSystem(!enableLoginSystem)}
                            style={{ ...switchTrackStyle, background: enableLoginSystem ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: enableLoginSystem ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px border-blue-500/30', color: '#60a5fa', fontSize: '0.85rem' }}>
                    ℹ️ 提示：更改設定後，系統將自動調整全域列表與單據的欄位呈現方式。
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;
