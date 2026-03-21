import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Layers, Globe, Users, FileText, Settings, Keyboard, Search, Package, BarChart3, ClipboardList } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topnav from '../components/Topnav';
import { DEFAULT_NAV_ORDER, useAppStore } from '../store/useAppStore';
import { useTranslation } from '../i18n';
import styles from './AppLayout.module.css';

const AppLayout = () => {
    const location = useLocation();
    const { t } = useTranslation();
    const { operationMode, navOrder, setNavOrder } = useAppStore();
    const isStandalonePage = new URLSearchParams(location.search).get('standalone') === '1';
    const [draggingCardIndex, setDraggingCardIndex] = useState(null);
    const routeTitleMap = useMemo(() => ({
        '/pim': t('sidebar.pim'),
        '/sourcing': t('sidebar.sourcing'),
        '/suppliers': t('sidebar.contacts'),
        '/customers': t('sidebar.contacts'),
        '/employees': t('sidebar.contacts'),
        '/documents': t('sidebar.documents'),
        '/reports': t('sidebar.reports'),
        '/settings': t('sidebar.config'),
        '/shorthand-config': t('sidebar.shorthand'),
    }), [t]);

    useEffect(() => {
        const matchedTitle = routeTitleMap[location.pathname];
        const params = new URLSearchParams(location.search);
        const docTab = params.get('tab');
        const docType = params.get('type');
        const docNameMap = {
            quotation: '報價單',
            sales: '銷貨單',
            salesReturn: '銷貨退回',
            inquiry: '詢價單',
            purchase: '進貨單',
            purchaseReturn: '進貨退回',
            shortageBook: '缺貨簿',
        };
        if (operationMode === 'tabbed' && !isStandalonePage) {
            document.title = '新分頁模式';
            return;
        }
        if (location.pathname === '/documents' && docTab && docNameMap[docTab]) {
            document.title = docNameMap[docTab];
            return;
        }
        if (location.pathname === '/document-editor' && docType && docNameMap[docType]) {
            document.title = docNameMap[docType];
            return;
        }
        if (matchedTitle) {
            document.title = matchedTitle;
        }
    }, [location.pathname, routeTitleMap, operationMode, isStandalonePage]);

    if (operationMode === 'tabbed' && !isStandalonePage) {
        const quickLinkMap = [
            { path: '/pim', label: t('sidebar.pim'), icon: Layers },
            { path: '/sourcing', label: t('sidebar.sourcing'), icon: Globe },
            { path: '/suppliers', label: t('sidebar.contacts'), icon: Users },
            { path: '/documents', label: t('sidebar.documents'), icon: FileText },
            { path: '/reports', label: t('sidebar.reports'), icon: BarChart3 },
            { path: '/settings', label: t('sidebar.config'), icon: Settings },
            { path: '/shorthand-config', label: t('sidebar.shorthand'), icon: Keyboard },
        ];
        const normalizedOrder = [
            ...navOrder.filter((path) => DEFAULT_NAV_ORDER.includes(path)),
            ...DEFAULT_NAV_ORDER.filter((path) => !navOrder.includes(path)),
        ];
        const quickLinks = normalizedOrder
            .map((path) => quickLinkMap.find((item) => item.path === path))
            .filter(Boolean);

        const handleCardDragStart = (e, index) => {
            setDraggingCardIndex(index);
            e.dataTransfer.effectAllowed = 'move';
        };

        const handleCardDragOver = (e, index) => {
            e.preventDefault();
            if (draggingCardIndex === null || draggingCardIndex === index) return;

            const newOrder = [...normalizedOrder];
            const draggedPath = newOrder[draggingCardIndex];
            newOrder.splice(draggingCardIndex, 1);
            newOrder.splice(index, 0, draggedPath);
            setDraggingCardIndex(index);
            setNavOrder(newOrder);
        };

        const handleCardDragEnd = () => {
            setDraggingCardIndex(null);
        };

        const openStandalonePath = (path) => {
            const targetUrl = new URL(path, window.location.origin);
            targetUrl.searchParams.set('standalone', '1');
            window.open(targetUrl.toString(), '_blank');
        };

        const docQuickGroups = [
            {
                title: '銷售業務',
                links: [
                    { key: 'quotation', label: '報價單', icon: FileText, path: '/documents?tab=quotation', color: '#2563eb' },
                    { key: 'sales', label: '銷貨單', icon: Layers, path: '/documents?tab=sales', color: '#16a34a' },
                    { key: 'salesReturn', label: '銷貨退回', icon: Layers, path: '/documents?tab=salesReturn', color: '#0ea5e9' },
                ],
            },
            {
                title: '採購業務',
                links: [
                    { key: 'inquiry', label: '詢價單', icon: Search, path: '/documents?tab=inquiry', color: '#8b5cf6' },
                    { key: 'purchase', label: '進貨單', icon: Package, path: '/documents?tab=purchase', color: '#f59e0b' },
                    { key: 'shortageBook', label: '缺貨簿', icon: ClipboardList, path: '/documents?tab=shortageBook', color: '#dc2626' },
                    { key: 'purchaseReturn', label: '進貨退回', icon: Package, path: '/documents?tab=purchaseReturn', color: '#f97316' },
                ],
            },
        ];
        const docQuickPanelStyle = {
            marginTop: '1.1rem',
            marginBottom: '2rem',
            padding: '0.9rem 1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
        };

        return (
            <div className={styles.layout}>
                <div className={styles.mainArea}>
                    <main className={`${styles.content} ${styles.launcherContent}`}>
                        <div className={styles.launcherWrap}>
                            <div className={styles.launcherHeader}>
                                <h1 className={styles.launcherTitle}>新分頁模式</h1>
                                <p className={styles.launcherDesc}>
                                    請選擇要開啟的功能（開新分頁，顯示於原分頁旁）。
                                </p>
                                <div style={{ marginTop: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setNavOrder([...DEFAULT_NAV_ORDER])}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-secondary)',
                                            padding: '0.4rem 0.75rem',
                                            borderRadius: '8px',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        重設為預設順序
                                    </button>
                                </div>
                            </div>
                            <div style={docQuickPanelStyle}>
                                <div style={{ marginBottom: '0.55rem', color: 'var(--text-muted)', fontSize: '0.86rem', fontWeight: 700 }}>
                                    單據快捷（直接進入編輯）
                                </div>
                                <div style={{ display: 'grid', gap: '0.85rem' }}>
                                    {docQuickGroups.map((group) => (
                                        <div key={group.title}>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.45rem' }}>
                                                {group.title}
                                            </div>
                                            <div className={`${styles.launcherGrid} ${styles.docQuickGrid}`}>
                                                {group.links.map((item) => (
                                                    <button
                                                        key={item.key}
                                                        onClick={() => openStandalonePath(item.path)}
                                                        className={styles.launcherCard}
                                                        style={{ borderColor: `${item.color}66` }}
                                                    >
                                                        <item.icon size={20} className={styles.launcherCardIcon} style={{ color: item.color }} />
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.launcherGrid}>
                                {quickLinks.map((item) => (
                                    <button
                                        key={item.path}
                                        draggable
                                        onDragStart={(e) => handleCardDragStart(e, quickLinks.findIndex((q) => q.path === item.path))}
                                        onDragOver={(e) => handleCardDragOver(e, quickLinks.findIndex((q) => q.path === item.path))}
                                        onDragEnd={handleCardDragEnd}
                                        onClick={() => openStandalonePath(item.path)}
                                        className={styles.launcherCard}
                                        style={{ opacity: draggingCardIndex === quickLinks.findIndex((q) => q.path === item.path) ? 0.6 : 1 }}
                                        title="可拖曳調整順序"
                                    >
                                        <item.icon size={22} className={styles.launcherCardIcon} />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            {!isStandalonePage && <Sidebar />}
            <div className={styles.mainArea}>
                <Topnav />
                <main className={styles.content}>
                    <div className={styles.contentOutlet}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
