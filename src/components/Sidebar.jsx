import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Layers, Search, BarChart3, Settings, ShieldAlert, Users, FileText, Globe, Keyboard, ChevronLeft, ChevronRight, ScanLine, Wallet } from 'lucide-react';
import { useTranslation } from '../i18n';
import { DEFAULT_NAV_ORDER, useAppStore } from '../store/useAppStore';
import styles from './Sidebar.module.css';

const Sidebar = () => {
    const { t } = useTranslation();
    const {
        sidebarCollapsed, toggleSidebar, navOrder, setNavOrder,
        operationMode
    } = useAppStore();
    const [draggingIndex, setDraggingIndex] = useState(null);

    const staticNavItems = [
        { name: t('sidebar.pim'), path: '/pim', icon: Layers },
        { name: t('sidebar.sourcing'), path: '/sourcing', icon: Globe },
        { name: t('sidebar.contacts'), path: '/suppliers', icon: Users },
        { name: t('sidebar.documents'), path: '/documents', icon: FileText },
        { name: t('sidebar.reports'), path: '/reports', icon: BarChart3 },
        { name: t('sidebar.inventoryCount'), path: '/inventory-count', icon: ScanLine },
        { name: t('sidebar.settlement'), path: '/settlement', icon: Wallet },
        { name: t('sidebar.config'), path: '/settings', icon: Settings },
        { name: t('sidebar.shorthand'), path: '/shorthand-config', icon: Keyboard },
    ];

    const normalizedOrder = [
        ...navOrder.filter((path) => DEFAULT_NAV_ORDER.includes(path)),
        ...DEFAULT_NAV_ORDER.filter((path) => !navOrder.includes(path)),
    ];

    const navItems = normalizedOrder
        .map(path => staticNavItems.find(item => item.path === path))
        .filter(Boolean);

    const handleDragStart = (e, index) => {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add(styles.isDragging);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggingIndex === null || draggingIndex === index) return;
        const newOrder = [...normalizedOrder];
        const draggedItem = newOrder[draggingIndex];
        newOrder.splice(draggingIndex, 1);
        newOrder.splice(index, 0, draggedItem);
        setDraggingIndex(index);
        setNavOrder(newOrder);
    };

    const handleDragEnd = (e) => {
        setDraggingIndex(null);
        e.currentTarget.classList.remove(styles.isDragging);
    };

    const handleNavClick = (e, path) => {
        if (operationMode !== 'tabbed') return;
        e.preventDefault();
        const targetUrl = new URL(path, window.location.origin);
        targetUrl.searchParams.set('standalone', '1');
        window.open(targetUrl.toString(), '_blank');
    };

    return (
        <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''} ${operationMode === 'tabbed' ? styles.windowMode : ''}`}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>
                    <ShieldAlert size={28} />
                </div>
                <span className={styles.logoText}>ARUFA</span>
            </div>

            {operationMode === 'tabbed' && !sidebarCollapsed && (
                <div className={styles.windowModeHint}>
                    <div className={styles.windowModeTitle}>獨立頁面模式</div>
                    <div className={styles.windowModeDesc}>點選功能會開新分頁（原分頁旁）</div>
                </div>
            )}

            <nav className={styles.nav}>
                {navItems.map((item, index) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        draggable={operationMode !== 'tabbed'}
                        onClick={(e) => handleNavClick(e, item.path)}
                        onDragStart={(e) => operationMode !== 'tabbed' && handleDragStart(e, index)}
                        onDragOver={(e) => operationMode !== 'tabbed' && handleDragOver(e, index)}
                        onDragEnd={(e) => operationMode !== 'tabbed' && handleDragEnd(e)}
                        className={({ isActive }) =>
                            `${styles.navItem} ${isActive && operationMode !== 'tabbed' ? styles.active : ''} ${draggingIndex === index ? styles.dragged : ''}`
                        }
                        title={operationMode === 'tabbed' ? `${item.name}（新分頁）` : (sidebarCollapsed ? item.name : '')}
                    >
                        <item.icon className={styles.navItemIcon} />
                        <span className={styles.navItemName}>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-gray-800/10">
                <button
                    className={styles.toggleBtn}
                    onClick={toggleSidebar}
                    title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {sidebarCollapsed ? <ChevronRight size={20} /> : (
                        <div className="flex items-center gap-2">
                            <ChevronLeft size={20} />
                            <span className="text-sm font-semibold">隱藏選單</span>
                        </div>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
