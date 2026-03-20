import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useDocumentStore } from './store/useDocumentStore';
import { useProductStore } from './store/useProductStore';
import { useSupplierStore } from './store/useSupplierStore';
import { useCustomerStore } from './store/useCustomerStore';
import { useEmployeeStore } from './store/useEmployeeStore';
import { useAppStore } from './store/useAppStore';
import ProductList from './pages/PIM/ProductList';
import SourcingList from './pages/Sourcing/SourcingList';
import ContactManager from './pages/Contacts/ContactManager';
import DocumentHub from './pages/Documents/DocumentHub';
import DocumentEditorPage from './pages/Documents/DocumentEditorPage';
import SystemSettings from './pages/Config/SystemSettings';
import ShorthandConfig from './pages/Config/ShorthandConfig';
import ReportsPage from './pages/Reports/ReportsPage';
import LoginPage from './pages/Auth/LoginPage';
import { usePriceInputSelectOnFocus } from './hooks/usePriceInputSelectOnFocus';
// import useGlobalEnterNavigation from './hooks/useGlobalEnterNavigation';

function App() {
  usePriceInputSelectOnFocus(); // 聚焦單價/售價/定價等數字欄位時全選
  // useGlobalEnterNavigation(); // 暫時停用以排查白屏問題
  const { enableLoginSystem, currentUserEmpId, displayMode } = useAppStore();
  // Logic to sync Zustand stores across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key) return;
      if (e.key === 'erp-document-store') useDocumentStore.persist.rehydrate();
      if (e.key === 'erp-product-store') useProductStore.persist.rehydrate();
      if (e.key === 'erp-supplier-store') useSupplierStore.persist.rehydrate();
      if (e.key === 'erp-customer-store') useCustomerStore.persist.rehydrate();
      if (e.key === 'erp-employee-store') useEmployeeStore.persist.rehydrate();
      if (e.key === 'erp-app-store') useAppStore.persist.rehydrate();
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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            enableLoginSystem
              ? (!currentUserEmpId ? <LoginPage /> : <Navigate to="/" replace />)
              : <Navigate to="/" replace />
          }
        />
        <Route
          path="/"
          element={
            enableLoginSystem && !currentUserEmpId
              ? <Navigate to="/login" replace />
              : <AppLayout />
          }
        >
          <Route index element={<Navigate to="/pim" replace />} />
          <Route path="pim" element={<ProductList />} />
          <Route path="sourcing" element={<SourcingList />} />
          <Route path="suppliers" element={<ContactManager />} />
          <Route path="customers" element={<ContactManager />} />
          <Route path="employees" element={<ContactManager />} />
          <Route path="documents" element={<DocumentHub />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="shorthand-config" element={<ShorthandConfig />} />
        </Route>
        <Route path="/document-editor" element={<DocumentEditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
