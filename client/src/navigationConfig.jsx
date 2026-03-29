import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  DollarSign,
  ShieldCheck,
  FileText,
  Settings,
  Radio,
  Contact,
  BookOpen,
  Calendar,
  LineChart,
} from 'lucide-react';
import { canAccessRole } from './accessControl';

export const NAV_SECTIONS = [
  {
    group: 'Leadership',
    items: [
      {
        to: '/dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_ADMIN_OFFICER',
          'ADMIN_ASSISTANT',
          'COMMUNITY_DEVELOPMENT_OFFICER',
          'PSYCHOSOCIAL_SUPPORT_OFFICER',
          'ME_INTERN_ACTING_OFFICER',
        ],
      },
      {
        to: '/analytics',
        label: 'Analytics',
        icon: LineChart,
        allowedRoles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ME_INTERN_ACTING_OFFICER'],
      },
    ],
  },
  {
    group: 'Programs',
    items: [
      {
        to: '/programs',
        label: 'Programs',
        icon: FolderKanban,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_ADMIN_OFFICER',
          'LOGISTICS_ASSISTANT',
          'COMMUNITY_DEVELOPMENT_OFFICER',
          'PSYCHOSOCIAL_SUPPORT_OFFICER',
          'ME_INTERN_ACTING_OFFICER',
        ],
      },
      {
        to: '/facilitators',
        label: 'Facilitators',
        icon: Users,
        allowedRoles: [
          'DIRECTOR',
          'ADMIN_ASSISTANT',
          'COMMUNITY_DEVELOPMENT_OFFICER',
          'PSYCHOSOCIAL_SUPPORT_OFFICER',
          'ME_INTERN_ACTING_OFFICER',
        ],
      },
      {
        to: '/me',
        label: 'Monitoring & Evaluation',
        icon: BarChart3,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_ADMIN_OFFICER',
          'COMMUNITY_DEVELOPMENT_OFFICER',
          'PSYCHOSOCIAL_SUPPORT_OFFICER',
          'ME_INTERN_ACTING_OFFICER',
        ],
      },
    ],
  },
  {
    group: 'Finance & Ops',
    items: [
      {
        to: '/finance',
        label: 'Finance & Logistics',
        icon: DollarSign,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_ADMIN_OFFICER',
          'ADMIN_ASSISTANT',
          'LOGISTICS_ASSISTANT',
          'COMMUNITY_DEVELOPMENT_OFFICER',
          'PSYCHOSOCIAL_SUPPORT_OFFICER',
        ],
      },
      {
        to: '/governance',
        label: 'Governance Queue',
        icon: ShieldCheck,
        allowedRoles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT'],
      },
      {
        to: '/reports',
        label: 'Reports',
        icon: FileText,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_ADMIN_OFFICER',
          'ADMIN_ASSISTANT',
          'COMMUNITY_DEVELOPMENT_OFFICER',
          'PSYCHOSOCIAL_SUPPORT_OFFICER',
          'ME_INTERN_ACTING_OFFICER',
        ],
      },
    ],
  },
  {
    group: 'Administration',
    items: [
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        allowedRoles: ['FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT'],
      },
      {
        to: '/users',
        label: 'User Management',
        icon: Users,
        allowedRoles: ['ADMIN_ASSISTANT'],
      },
    ],
  },
  {
    group: 'My Work',
    items: [
      {
        to: '/my-portal',
        label: 'My Portal',
        icon: LayoutDashboard,
        allowedRoles: [
          'DEVELOPMENT_FACILITATOR',
          'SOCIAL_SERVICES_INTERN',
          'YOUTH_COMMUNICATIONS_INTERN',
        ],
      },
    ],
  },
  {
    group: 'Intranet',
    items: [
      {
        to: '/intranet/dashboard',
        label: 'Announcements',
        icon: Radio,
        allowedRoles: null,
      },
      {
        to: '/intranet/directory',
        label: 'Staff Directory',
        icon: Contact,
        allowedRoles: null,
      },
      {
        to: '/intranet/documents',
        label: 'Document Library',
        icon: BookOpen,
        allowedRoles: null,
      },
      {
        to: '/intranet/calendar',
        label: 'Organization Calendar',
        icon: Calendar,
        allowedRoles: null,
      },
    ],
  },
];

const routeMap = new Map(NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.to, item])));

export const getNavigationForUser = (user) =>
  NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessRole(user, item.allowedRoles)),
    }))
    .filter((section) => section.items.length > 0);

export const getSearchableRoutes = (user) =>
  NAV_SECTIONS.flatMap((section) =>
    section.items.filter((item) => canAccessRole(user, item.allowedRoles))
  );

export const getAllowedRolesForPath = (path) => routeMap.get(path)?.allowedRoles || null;

export const getPageTitle = (path) => routeMap.get(path)?.label || 'MMPZ ERP';

export const isGovernanceRoute = (path) => path === '/governance';
