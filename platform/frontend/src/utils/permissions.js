export const PERMISSIONS = {
  MEMBERS_VIEW: "members.view",
  MEMBERS_EDIT: "members.edit",
  FINANCE_APPROVE: "finance.approve",
  INVENTORY_MANAGE: "inventory.manage",
  DOCUMENTS_UPLOAD: "documents.upload"
};

export const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (!user) return false;
  return (user.permissions || []).includes(permission);
};

export const requirePermission = (user, permission, fallback = false) => {
  if (!permission) return true;
  return hasPermission(user, permission) || fallback;
};
