import React, { useState } from 'react';
import { Search, Bell, HelpCircle, Globe, Database, LogOut } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { useTranslation } from '../i18n';
import { useEmployeeStore } from '../store/useEmployeeStore';
import { useAppStore } from '../store/useAppStore';
import DataBackupModal from './DataBackupModal';
import styles from './Topnav.module.css';

const Topnav = () => {
    const { searchQuery, setSearchQuery } = useProductStore();
    const { t, language, setLanguage } = useTranslation();
    const { enableLoginSystem, currentUserEmpId, logout } = useAppStore();
    const { employees } = useEmployeeStore();
    const [showBackupModal, setShowBackupModal] = useState(false);
    const currentUser = employees.find((e) => e.emp_id === currentUserEmpId);
    const avatarText = (currentUser?.name || 'JS').slice(0, 2);

    return (
        <header className={styles.topnav}>
            <div style={{ flex: 1 }} />

            <div className={styles.profileDiv}>
                <button
                    className={styles.iconBtn}
                    aria-label="Toggle Language"
                    onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                >
                    <Globe size={20} />
                    <span className="ml-2 text-xs font-semibold">{language === 'en' ? 'EN' : '繁體'}</span>
                </button>
                <button
                    className={`${styles.iconBtn} text-accent-primary bg-accent-subtle`}
                    aria-label="Database Backup"
                    onClick={() => setShowBackupModal(true)}
                    title="資料備份與還原"
                >
                    <Database size={20} />
                </button>
                <button className={styles.iconBtn} aria-label="Help">
                    <HelpCircle size={20} />
                </button>
                <button className={styles.iconBtn} aria-label="Notifications">
                    <Bell size={20} />
                </button>
                {enableLoginSystem && (
                    <button className={styles.iconBtn} aria-label="Logout" title="登出" onClick={logout}>
                        <LogOut size={18} />
                    </button>
                )}
                <div className={styles.avatar} aria-label="User Avatar">{avatarText}</div>
            </div>

            {showBackupModal && <DataBackupModal onClose={() => setShowBackupModal(false)} />}
        </header>
    );
};

export default Topnav;
