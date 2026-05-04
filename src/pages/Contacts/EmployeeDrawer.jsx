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
        employee_code: '',
        name: '',
        phone: '',
        mobile: '',
        address: '',
        id_number: '',
        birthplace: '',
        birthday: '',
        marriage: '',
        dependents: '',
        department: '業務部',
        role: '',
        target_performance: '',
        salary: '',
        hire_date: new Date().toISOString().split('T')[0],
        notes: '',
        created_date: '',
        last_modified_date: '',
        permission_role: '一般',
        email: '',
        extension: '',
        status: '在職'
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
                    {/* 基本身分與聯繫資料 */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>基本身分與聯繫資料</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>代號</label>
                                <input className={drawerStyles.input} value={form.employee_code || ''} onChange={(e) => set('employee_code', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 2 }}>
                                <label className={drawerStyles.label}>名稱</label>
                                <input className={drawerStyles.input} value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>電話</label>
                                <input className={drawerStyles.input} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>行動</label>
                                <input className={drawerStyles.input} value={form.mobile || ''} onChange={(e) => set('mobile', e.target.value)} />
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>住址</label>
                            <input className={drawerStyles.input} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>身分證字號</label>
                                <input className={drawerStyles.input} value={form.id_number || ''} onChange={(e) => set('id_number', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>籍貫</label>
                                <input className={drawerStyles.input} value={form.birthplace || ''} onChange={(e) => set('birthplace', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>生日</label>
                                <input className={drawerStyles.input} type="date" value={form.birthday || ''} onChange={(e) => set('birthday', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>婚姻</label>
                                <input className={drawerStyles.input} value={form.marriage || ''} onChange={(e) => set('marriage', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>撫養人數</label>
                                <input className={drawerStyles.input} type="number" value={form.dependents || ''} onChange={(e) => set('dependents', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* 職務與薪資資料 */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>職務與薪資資料</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>部門</label>
                                <select className={drawerStyles.input} value={form.department || '業務部'} onChange={(e) => set('department', e.target.value)}>
                                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>職務</label>
                                <input className={drawerStyles.input} value={form.role || ''} onChange={(e) => set('role', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>責任業績</label>
                                <input className={drawerStyles.input} value={form.target_performance || ''} onChange={(e) => set('target_performance', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>薪資</label>
                                <input className={drawerStyles.input} value={form.salary || ''} onChange={(e) => set('salary', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>起雇日</label>
                                <input className={drawerStyles.input} type="date" value={form.hire_date || ''} onChange={(e) => set('hire_date', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* 系統與備註 */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>系統與備註</div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>備註</label>
                            <textarea
                                className={drawerStyles.input}
                                style={{ minHeight: '80px', resize: 'vertical' }}
                                value={form.notes || ''}
                                onChange={(e) => set('notes', e.target.value)}
                                placeholder="員工備註..."
                            />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>建立日</label>
                                <input className={drawerStyles.input} type="date" value={form.created_date || ''} onChange={(e) => set('created_date', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>最後修改日</label>
                                <input className={drawerStyles.input} type="date" value={form.last_modified_date || ''} onChange={(e) => set('last_modified_date', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDrawer;
