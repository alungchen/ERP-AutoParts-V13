import React, { useEffect } from 'react';
import { bootstrapFromD1 } from './lib/d1Bootstrap';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useDocumentStore } from './store/useDocumentStore';
import { useProductStore } from './store/useProductStore';
import { useSupplierStore } from './store/useSupplierStore';
import { useCustomerStore } from './store/useCustomerStore';
import { useEmployeeStore } from './store/useEmployeeStore';
import { useImportEstimateStore } from './store/useImportEstimateStore';
import { useSettlementStore } from './store/useSettlementStore';
import { useAppStore } from './store/useAppStore';
import { useSourcingStore } from './store/useSourcingStore';
import { useShorthandStore } from './store/useShorthandStore';
import ProductList from './pages/PIM/ProductList';
import SourcingList from './pages/Sourcing/SourcingList';
import ImportEstimateHub from './pages/Sourcing/ImportEstimateHub';
import ContactManager from './pages/Contacts/ContactManager';
import DocumentHub from './pages/Documents/DocumentHub';
import DocumentEditorPage from './pages/Documents/DocumentEditorPage';
import SystemSettings from './pages/Config/SystemSettings';
import ShorthandConfig from './pages/Config/ShorthandConfig';
import ReportsPage from './pages/Reports/ReportsPage';
import LoginPage from './pages/Auth/LoginPage';
import InventoryCountPage from './pages/InventoryCount/InventoryCountPage';
import SettlementPage from './pages/Settlement/SettlementPage';
import { usePriceInputSelectOnFocus } from './hooks/usePriceInputSelectOnFocus';
import { isAdminUser } from './utils/permissions';
// import useGlobalEnterNavigation from './hooks/useGlobalEnterNavigation';

/** 僅限「管理員」角色進入的頁面守衛（登入管理未設定時不鎖，避免鎖死） */
function RequireAdmin({ children }) {
  const { enableLoginSystem, enablePermissionRole, currentUserEmpId } = useAppStore();
  const { employees } = useEmployeeStore();
  const currentUser = employees.find((e) => e.emp_id === currentUserEmpId);

  if (isAdminUser({ enableLoginSystem, enablePermissionRole, currentUser, employees })) {
    return children;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.8rem', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>🔒</div>
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>權限不足</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
        此頁面僅限「管理員」角色使用。<br />如需存取請聯絡系統管理員調整您的權限角色。
      </p>
    </div>
  );
}

function App() {
  usePriceInputSelectOnFocus(); // 聚焦單價/售價/定價等數字欄位時全選
  // useGlobalEnterNavigation(); // 暫時停用以排查白屏問題
  const { enableLoginSystem, currentUserEmpId, displayMode, uiScale, activeBranchId, fetchBranches } = useAppStore();
  const fetchProducts = useProductStore(state => state.fetchProducts);
  const fetchShorthands = useShorthandStore(state => state.fetchShorthands);
  const fetchDocuments = useDocumentStore(state => state.fetchDocuments);
  const fetchCustomers = useCustomerStore(state => state.fetchCustomers);
  const fetchSuppliers = useSupplierStore(state => state.fetchSuppliers);

  useEffect(() => {
    void bootstrapFromD1();
    fetchBranches();
    fetchProducts();
    fetchShorthands();
  }, [fetchBranches, fetchProducts, fetchShorthands]);

  // Fetch branch-specific data on active branch change (which covers initial load too)
  useEffect(() => {
    fetchDocuments();
    fetchCustomers();
    fetchSuppliers();
  }, [activeBranchId, fetchDocuments, fetchCustomers, fetchSuppliers]);

  // Logic to sync Zustand stores across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key) return;
      if (e.key === 'erp-document-store') useDocumentStore.persist.rehydrate();
      if (e.key === 'erp-supplier-store') useSupplierStore.persist.rehydrate();
      if (e.key === 'erp-customer-store') useCustomerStore.persist.rehydrate();
      if (e.key === 'erp-employee-store') useEmployeeStore.persist.rehydrate();
      if (e.key === 'erp-app-store') useAppStore.persist.rehydrate();
      if (e.key === 'erp-import-estimates') useImportEstimateStore.persist.rehydrate();
      if (e.key === 'erp-settlement-store') useSettlementStore.persist.rehydrate();
      if (e.key === 'erp-sourcing-store') useSourcingStore.persist.rehydrate();
      if (e.key === 'erp-shorthand-store') useShorthandStore.persist.rehydrate();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (displayMode !== 'system') {
      document.documentElement.setAttribute('data-theme', displayMode || 'nightclub');
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'nightclub' : 'light');
    };

    applySystemTheme();
    mediaQuery.addEventListener('change', applySystemTheme);
    return () => mediaQuery.removeEventListener('change', applySystemTheme);
  }, [displayMode]);

  useEffect(() => {
    const scale = ['normal', 'large', 'xlarge'].includes(uiScale) ? uiScale : 'normal';
    document.documentElement.setAttribute('data-ui-scale', scale);
  }, [uiScale]);

  // Dynamic theme colors per branch to prevent user operation errors
  useEffect(() => {
    const root = document.documentElement;
    if (activeBranchId === 'xizhi') {
      // Emerald Green theme for Xizhi
      root.style.setProperty('--accent-primary', '#10B981');
      root.style.setProperty('--accent-hover', '#059669');
      root.style.setProperty('--accent-subtle', 'rgba(16, 185, 129, 0.15)');
    } else if (activeBranchId === 'linkou') {
      // Amber/Orange theme for Linkou
      root.style.setProperty('--accent-primary', '#F59E0B');
      root.style.setProperty('--accent-hover', '#D97706');
      root.style.setProperty('--accent-subtle', 'rgba(245, 158, 11, 0.15)');
    } else {
      // Default (songshan) - reset to default stylesheet styles
      root.style.removeProperty('--accent-primary');
      root.style.removeProperty('--accent-hover');
      root.style.removeProperty('--accent-subtle');
    }
  }, [activeBranchId]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            !currentUserEmpId ? <LoginPage /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/"
          element={
            !currentUserEmpId
              ? <Navigate to="/login" replace />
              : <AppLayout />
          }
        >
          <Route index element={<Navigate to="/pim" replace />} />
          <Route path="pim" element={<ProductList />} />
          <Route path="sourcing" element={<Outlet />}>
            <Route index element={<ImportEstimateHub />} />
            <Route path="estimate" element={<SourcingList />} />
          </Route>
          <Route path="import-cost" element={<Navigate to="/sourcing" replace />} />
          <Route path="import-cost/estimate" element={<Navigate to="/sourcing/estimate" replace />} />
          <Route path="suppliers" element={<ContactManager />} />
          <Route path="customers" element={<ContactManager />} />
          <Route path="employees" element={<RequireAdmin><ContactManager /></RequireAdmin>} />
          <Route path="documents" element={<DocumentHub />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="inventory-count" element={<InventoryCountPage />} />
          <Route path="settlement" element={<SettlementPage />} />
          <Route path="settings" element={<RequireAdmin><SystemSettings /></RequireAdmin>} />
          <Route path="shorthand-config" element={<ShorthandConfig />} />
        </Route>
        <Route path="/document-editor" element={<DocumentEditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
