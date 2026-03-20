export const canEditDocType = ({ enableLoginSystem, enablePermissionRole, currentUser, docType }) => {
    if (!enableLoginSystem || !enablePermissionRole) return true;
    if (!currentUser) return false;

    const role = currentUser.permission_role || '一般';
    if (role === '管理員') return true;
    if (role === '業務') return docType === 'quotation' || docType === 'sales' || docType === 'salesReturn';
    if (role === '採購') return docType === 'inquiry' || docType === 'purchase' || docType === 'purchaseReturn';
    return false;
};
