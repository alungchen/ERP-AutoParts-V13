import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';

const initialEmployees = [
    {
        emp_id: 'EMP-001',
        name: '陳志明',
        department: '業務部',
        role: '業務經理',
        permission_role: '管理員',
        email: 'jim.chen@arufa.com',
        phone: '0912-345-678',
        extension: '201',
        status: '在職',
        hire_date: '2021-05-10',
        address: '台中市西屯區',
        notes: '負責北區大客戶。'
    },
    {
        emp_id: 'EMP-002',
        name: '王雅婷',
        department: '採購部',
        role: '採購專員',
        permission_role: '採購',
        email: 'yating.wang@arufa.com',
        phone: '0988-123-456',
        extension: '305',
        status: '在職',
        hire_date: '2022-01-17',
        address: '台北市內湖區',
        notes: '負責日本與台灣供應商窗口。'
    }
];

export const useEmployeeStore = create(persist((set) => ({
    employees: initialEmployees,
    selectedEmployee: null,
    setSelectedEmployee: (e) => set({ selectedEmployee: e }),
    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    addEmployee: (employee) => set((state) => ({
        employees: [{ ...employee, emp_id: `EMP-${Math.floor(100 + Math.random() * 900)}` }, ...state.employees]
    })),
    updateEmployee: (updated) => set((state) => ({
        employees: state.employees.map(e => e.emp_id === updated.emp_id ? updated : e),
        selectedEmployee: state.selectedEmployee?.emp_id === updated.emp_id ? updated : state.selectedEmployee
    })),
    deleteEmployee: (id) => set((state) => ({
        employees: state.employees.filter(e => e.emp_id !== id),
        selectedEmployee: state.selectedEmployee?.emp_id === id ? null : state.selectedEmployee
    })),
    bulkUpdateEmployees: (list) => set((state) => {
        let updatedList = [...state.employees];
        list.forEach(item => {
            const idx = updatedList.findIndex(e => e.emp_id === item.emp_id);
            if (idx !== -1) updatedList[idx] = { ...updatedList[idx], ...item };
            else updatedList = [item, ...updatedList];
        });
        return { employees: updatedList };
    })
}), { name: 'erp-employee-store', storage: erpPersistStorage }));
