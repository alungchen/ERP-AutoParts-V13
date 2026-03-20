import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_NAV_ORDER = ['/documents', '/pim', '/suppliers', '/shorthand-config', '/sourcing', '/reports', '/settings'];

export const useAppStore = create(persist((set) => ({
    language: 'zh', // Default to Traditional Chinese
    setLanguage: (lang) => set({ language: lang }),

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

    enablePermissionRole: true,
    setEnablePermissionRole: (enabled) => set({ enablePermissionRole: enabled }),

    enableLoginSystem: false,
    setEnableLoginSystem: (enabled) => set((state) => ({
        enableLoginSystem: enabled,
        currentUserEmpId: enabled ? state.currentUserEmpId : ''
    })),
    currentUserEmpId: '',
    loginAsEmployee: (empId) => set({ currentUserEmpId: empId }),
    logout: () => set({ currentUserEmpId: '' }),

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
}), { name: 'erp-app-store' }));
