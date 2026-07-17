import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';
import { auth, signOut } from '../firebase';

export const DEFAULT_NAV_ORDER = ['/documents', '/pim', '/suppliers', '/sourcing', '/shorthand-config', '/reports', '/inventory-count', '/settlement', '/settings'];

/** 系統設定「顯示模式」字卡預設順序（可拖曳自訂，見 displayModeCardOrder） */
export const DEFAULT_DISPLAY_MODE_CARD_ORDER = ['nightclub', 'light', 'warm', 'system'];

export const useAppStore = create(persist((set) => ({
    language: 'zh', // Default to Traditional Chinese
    setLanguage: (lang) => set({ language: lang }),

    // Multi-branch settings
    activeBranchId: 'songshan',
    setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
    branches: [
        { branch_id: 'songshan', name: '松山店' },
        { branch_id: 'xizhi', name: '汐止店' },
        { branch_id: 'linkou', name: '林口店' }
    ],
    setBranches: (branches) => set({ branches }),
    fetchBranches: async () => {
        try {
            const res = await fetch('/api/branches');
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    set({ branches: data });
                }
            }
        } catch (err) {
            console.error('Failed to fetch branches:', err);
        }
    },

    // Page Title for Topnav
    pageTitle: '',
    pageTitleColor: '',
    setPageTitle: (title, color = '') => set({ pageTitle: title, pageTitleColor: color }),

    // System Settings
    defaultCurrency: 'TWD',
    setDefaultCurrency: (curr) => set({ defaultCurrency: curr }),
    vatEnabled: true,
    vatRate: 5,
    setVatEnabled: (enabled) => set({ vatEnabled: enabled }),
    setVatRate: (rate) => set({
        vatRate: Number.isFinite(Number(rate))
            ? Math.min(100, Math.max(0, Number(rate)))
            : 0
    }),
    displayMode: 'nightclub', // 'nightclub' | 'light' | 'warm' | 'system'
    setDisplayMode: (mode) => set({ displayMode: mode }),

    /** 全站字級：normal=標準、large=大、xlarge=特大（以 html rem 基準縮放） */
    uiScale: 'normal', // 'normal' | 'large' | 'xlarge'
    setUiScale: (scale) => set({
        uiScale: ['normal', 'large', 'xlarge'].includes(scale) ? scale : 'normal'
    }),

    displayModeCardOrder: DEFAULT_DISPLAY_MODE_CARD_ORDER,
    setDisplayModeCardOrder: (order) => set({ displayModeCardOrder: order }),

    /** 全站 F8 沿革視窗：目前選取之零件 p_id（由各頁面同步） */
    productHistoryFocusPId: null,
    setProductHistoryFocusPId: (pId) => set((state) => {
        const next = pId || null;
        return state.productHistoryFocusPId === next ? state : { productHistoryFocusPId: next };
    }),

    isMultiCountryMode: true,
    setMultiCountryMode: (enabled) => set({ isMultiCountryMode: enabled }),

    sidebarCollapsed: false,
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    // Default launcher/card order:
    // 1st row: documents, pim, suppliers
    // 2nd row: shorthand, sourcing, settings
    navOrder: DEFAULT_NAV_ORDER,
    setNavOrder: (newOrder) => set({ navOrder: newOrder }),

    showImportExport: false,
    setShowImportExport: (enabled) => set({ showImportExport: enabled }),

    showBatchDelete: false,
    setShowBatchDelete: (enabled) => set({ showBatchDelete: enabled }),

    enablePermissionRole: true,
    setEnablePermissionRole: (enabled) => set({ enablePermissionRole: enabled }),

    enableLoginSystem: true,
    setEnableLoginSystem: (enabled) => set((state) => ({
        enableLoginSystem: enabled,
        currentUserEmpId: enabled ? state.currentUserEmpId : '',
        currentUserEmail: enabled ? state.currentUserEmail : '',
        currentUserPhotoURL: enabled ? state.currentUserPhotoURL : ''
    })),
    currentUserEmpId: '',
    currentUserEmail: '',
    currentUserPhotoURL: '',
    /** empId 為員工名單中的 emp_id（白名單比對成功）；相容模式下暫存 email */
    loginAsEmployee: (empId, photoURL = '', email = '') => set({ currentUserEmpId: empId, currentUserPhotoURL: photoURL, currentUserEmail: email }),
    logout: () => {
        // 同步登出 Firebase，避免殘留的驗證狀態
        signOut(auth).catch(() => {});
        set({ currentUserEmpId: '', currentUserEmail: '', currentUserPhotoURL: '' });
    },

    // Navigation behavior mode
    operationMode: 'current', // 'current' | 'tabbed'
    setOperationMode: (mode) => set((state) => ({
        operationMode: mode,
        workspaceTabs: state.workspaceTabs?.length ? state.workspaceTabs : ['/pim'],
        activeWorkspaceTab: state.activeWorkspaceTab || '/pim'
    })),

    // Workspace tabs (used in tabbed mode)
    workspaceTabs: ['/pim'],
    activeWorkspaceTab: '/pim',
    openWorkspaceTab: (path) => set((state) => ({
        workspaceTabs: state.workspaceTabs.includes(path)
            ? state.workspaceTabs
            : [...state.workspaceTabs, path],
        activeWorkspaceTab: path
    })),
    setActiveWorkspaceTab: (path) => set({ activeWorkspaceTab: path }),
    closeWorkspaceTab: (path) => set((state) => {
        if (state.workspaceTabs.length <= 1) return {};
        return {
            workspaceTabs: state.workspaceTabs.filter((p) => p !== path),
            activeWorkspaceTab:
                state.activeWorkspaceTab === path
                    ? (state.workspaceTabs.find((p) => p !== path) || '/pim')
                    : state.activeWorkspaceTab
        };
    }),
}), {
    name: 'erp-app-store',
    storage: erpPersistStorage,
    merge: (persisted, current) => {
        const p = { ...(persisted && typeof persisted === 'object' ? persisted : {}) };
        delete p.priceFieldShortcutCustomer;
        delete p.priceFieldShortcutVendor;
        delete p.productHistoryDrawerShortcut;
        delete p.productHistoryFocusPId;
        return { ...current, ...p };
    },
}));
