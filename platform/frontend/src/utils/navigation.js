import {
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Home,
  Megaphone,
  MessageSquare,
  Package,
  Search,
  Settings,
  Shield,
  Users
} from "lucide-react";

export const sidebarSections = [
  { label: "Dashboard", items: [{ to: "/dashboard", icon: Home, label: "Dashboard" }] },
  {
    label: "ERP",
    items: [
      { to: "/erp/members", icon: Users, label: "Members", requiredPermission: "members.view" },
      { to: "/erp/finance", icon: CircleDollarSign, label: "Finance", requiredPermission: "finance.approve" },
      { to: "/erp/assets", icon: Building2, label: "Assets", requiredPermission: "members.view" },
      { to: "/erp/inventory", icon: Package, label: "Inventory", requiredPermission: "inventory.manage" },
      { to: "/erp/reports", icon: FileText, label: "Reports", requiredPermission: "members.view" }
    ]
  },
  {
    label: "Intranet",
    items: [
      { to: "/intranet/announcements", icon: Megaphone, label: "Announcements", requiredPermission: "members.view" },
      { to: "/intranet/documents", icon: FileText, label: "Documents", requiredPermission: "documents.upload" },
      { to: "/intranet/messaging", icon: MessageSquare, label: "Messaging", requiredPermission: "members.view" },
      { to: "/intranet/events", icon: CalendarDays, label: "Events", requiredPermission: "members.view" },
      { to: "/intranet/directory", icon: Users, label: "Directory", requiredPermission: "members.view" },
      { to: "/intranet/knowledge-base", icon: Search, label: "Knowledge Base", requiredPermission: "members.view" }
    ]
  },
  {
    label: "Administration",
    items: [
      { to: "/admin/users", icon: Users, label: "Users", requiredPermission: "members.edit" },
      { to: "/admin/roles", icon: Shield, label: "Roles", requiredPermission: "members.edit" },
      { to: "/admin/settings", icon: Settings, label: "Settings", requiredPermission: "members.edit" }
    ]
  }
];

export const quickActions = [
  { id: "add-member", label: "Add Member", icon: Users, requiredPermission: "members.edit" },
  { id: "record-donation", label: "Record Donation", icon: CircleDollarSign, requiredPermission: "finance.approve" },
  { id: "upload-document", label: "Upload Document", icon: FileText, requiredPermission: "documents.upload" },
  { id: "create-announcement", label: "Create Announcement", icon: Bell, requiredPermission: "members.edit" }
];

export const dashboardWidgets = [
  { id: "announcements", title: "Announcements", icon: Megaphone },
  { id: "events", title: "Upcoming Events", icon: CalendarDays },
  { id: "messages", title: "Recent Messages", icon: MessageSquare },
  { id: "financial-summary", title: "Financial Summary", icon: CircleDollarSign },
  { id: "inventory-alerts", title: "Inventory Alerts", icon: Boxes },
  { id: "new-members", title: "New Members", icon: Users },
  { id: "recent-activity", title: "Recent Activity", icon: Bell }
];
