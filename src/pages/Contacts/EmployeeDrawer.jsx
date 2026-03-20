import React, { useEffect, useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAppStore } from '../../store/useAppStore';
import drawerStyles from '../PIM/ProductDrawer.module.css';

const DEPARTMENTS = ['業務部', '採購部', '倉儲部', '財務部', '行政部', '資訊部'];
const STATUSES = ['在職', '留職停薪', '離職'];
const PERMISSION_ROLES = ['管理員', '業務', '採購', '財務', '倉管', '一般'];

const EmployeeDrawer = ({ employee, onClose }) => {
    const { addEmployee, updateEmployee, deleteEmployee } = useEmployeeStore();
    const { enablePermissionRole } = useAppStore();
    const isNew = !employee?.emp_id;

    const emptyForm = {
        emp_id: '',
        name: '',
        department: '業務部',
        role: '',
        permission_role: '一般',
        email: '',
        phone: '',
        extension: '',
        status: '在職',
        hire_date: new Date().toISOString().split('T')[0],
        address: '',
        notes: ''
    };

    const [form, setForm] = useState(emptyForm);
    const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

    useEffect(() => {
        if (employee) setForm({ ...emptyForm, ...employee });
        else setForm(emptyForm);
    }, [employee]);

    const handleSave = () => {
        if (isNew) addEmployee(form);
        else updateEmployee(form);
        onClose();
    };

    const confirmDelete = (label) => window.confirm(`確定要刪除「${label}」嗎？此操作無法復原。`);

    if (!employee && employee !== null) return null;

    return (
        <div className={`${drawerStyles.overlay} ${drawerStyles.open}`} onClick={onClose}>
            <div className={drawerStyles.drawer} onClick={(e) => e.stopPropagation()}>
                <div className={drawerStyles.header}>
                    <div className="flex-col gap-1">
                        <span className="text-muted text-xs font-mono">{isNew ? 'NEW' : form.emp_id}</span>
                        <span className={drawerStyles.title}>{isNew ? '新增員工' : form.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className={`${drawerStyles.closeBtn} text-success hover:bg-success-subtle`} onClick={handleSave} title="儲存">
                            <Save size={20} />
                        </button>
                        {!isNew && (
                            <button
                                className={`${drawerStyles.closeBtn} text-danger hover:bg-danger-subtle`}
                                onClick={() => {
                                    if (!confirmDelete(form.name || form.emp_id)) return;
                                    deleteEmployee(form.emp_id);
                                    onClose();
                                }}
                                title="刪除"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <div className="w-px h-6 bg-border-color mx-1"></div>
                        <button className={drawerStyles.closeBtn} onClick={onClose}><X size={22} /></button>
                    </div>
                </div>

                <div className={drawerStyles.content}>
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>基本資料</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>姓名</label>
                                <input className={drawerStyles.input} value={form.name} onChange={(e) => set('name', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>部門</label>
                                <select className={drawerStyles.input} value={form.department} onChange={(e) => set('department', e.target.value)}>
                                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>職稱</label>
                                <input className={drawerStyles.input} value={form.role} onChange={(e) => set('role', e.target.value)} />
                            </div>
                            {enablePermissionRole && (
                                <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                    <label className={drawerStyles.label}>權限角色</label>
                                    <select className={drawerStyles.input} value={form.permission_role || '一般'} onChange={(e) => set('permission_role', e.target.value)}>
                                        {PERMISSION_ROLES.map((p) => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>到職日</label>
                                <input className={drawerStyles.input} type="date" value={form.hire_date} onChange={(e) => set('hire_date', e.target.value)} />
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>狀態</label>
                            <select className={drawerStyles.input} value={form.status} onChange={(e) => set('status', e.target.value)}>
                                {STATUSES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>聯絡資訊</div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>Email</label>
                            <input className={drawerStyles.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>手機</label>
                                <input className={drawerStyles.input} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>分機</label>
                                <input className={drawerStyles.input} value={form.extension} onChange={(e) => set('extension', e.target.value)} />
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>地址</label>
                            <input className={drawerStyles.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
                        </div>
                    </div>

                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>備註</div>
                        <textarea
                            className={drawerStyles.input}
                            style={{ minHeight: '100px', resize: 'vertical' }}
                            value={form.notes}
                            onChange={(e) => set('notes', e.target.value)}
                            placeholder="員工備註..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDrawer;
