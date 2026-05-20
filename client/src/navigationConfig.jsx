import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  DollarSign,
  WalletCards,
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
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'MEL_OFFICER',
          'SYSTEM_ADMIN',
        ],
      },
      {
        to: '/analytics',
        label: 'Analytics',
        icon: LineChart,
        allowedRoles: ['DIRECTOR', 'MEL_OFFICER', 'SYSTEM_ADMIN'],
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
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'MEL_OFFICER',
          'SYSTEM_ADMIN',
        ],
      },
      {
        to: '/facilitators',
        label: 'Facilitators',
        icon: Users,
        allowedRoles: [
          'DIRECTOR',
          'ADMIN_FINANCE_ASSISTANT',
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'MEL_OFFICER',
          'SYSTEM_ADMIN',
        ],
      },
      {
        to: '/me',
        label: 'Monitoring & Evaluation',
        icon: BarChart3,
        allowedRoles: [
          'DIRECTOR',
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'MEL_OFFICER',
          'SYSTEM_ADMIN',
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
          'FINANCE_OFFICER',
          'ADMIN_FINANCE_ASSISTANT',
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'SYSTEM_ADMIN',
        ],
      },
      {
        to: '/budget',
        label: 'Budget Tracker',
        icon: WalletCards,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_OFFICER',
          'ADMIN_FINANCE_ASSISTANT',
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'MEL_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'YOUTH_FACILITATOR_PEER_EDUCATOR',
          'SYSTEM_ADMIN',
        ],
      },
      {
        to: '/governance',
        label: 'Governance Queue',
        icon: ShieldCheck,
        allowedRoles: ['DIRECTOR', 'FINANCE_OFFICER', 'ADMIN_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'],
      },
      {
        to: '/reports',
        label: 'Reports',
        icon: FileText,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_OFFICER',
          'ADMIN_FINANCE_ASSISTANT',
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'MEL_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'SYSTEM_ADMIN',
        ],
      },
    ],
  },
  {
    group: 'Governance & Compliance',
    items: [
      {
        to: '/governance/safeguarding',
        label: 'Safeguarding',
        icon: ShieldCheck,
        allowedRoles: ['DIRECTOR', 'SRHR_OFFICER', 'MEL_OFFICER', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/volunteers',
        label: 'Volunteer Management',
        icon: Users,
        allowedRoles: ['DIRECTOR', 'PROGRAMS_ME_OFFICER', 'MEL_OFFICER', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/donors',
        label: 'Donor Compliance',
        icon: FileText,
        allowedRoles: ['DIRECTOR', 'FINANCE_OFFICER', 'ADMIN_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/grants',
        label: 'Grant Management',
        icon: WalletCards,
        allowedRoles: ['DIRECTOR', 'FINANCE_OFFICER', 'ADMIN_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/supervision',
        label: 'Supervision Logs',
        icon: ShieldCheck,
        allowedRoles: ['DIRECTOR', 'PROGRAMS_ME_OFFICER', 'SRHR_OFFICER', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/knowledge-hub',
        label: 'Knowledge Hub Governance',
        icon: BookOpen,
        allowedRoles: ['DIRECTOR', 'YOUTH_KNOWLEDGE_HUB_OFFICER', 'MEL_OFFICER', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/referrals',
        label: 'Referral Governance',
        icon: Contact,
        allowedRoles: ['DIRECTOR', 'SRHR_OFFICER', 'PROGRAMS_ME_OFFICER', 'SYSTEM_ADMIN'],
      },
      {
        to: '/governance/performance',
        label: 'Staff Performance',
        icon: BarChart3,
        allowedRoles: ['DIRECTOR', 'MEL_OFFICER', 'SYSTEM_ADMIN'],
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
        allowedRoles: ['DIRECTOR', 'FINANCE_OFFICER', 'ADMIN_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'],
      },
      {
        to: '/users',
        label: 'User Management',
        icon: Users,
        allowedRoles: ['ADMIN_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'],
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
        allowedRoles: ['YOUTH_FACILITATOR_PEER_EDUCATOR'],
      },
      {
        to: '/submissions',
        label: 'Staff Submissions',
        icon: FileText,
        allowedRoles: [
          'DIRECTOR',
          'FINANCE_OFFICER',
          'ADMIN_FINANCE_ASSISTANT',
          'PROGRAMS_ME_OFFICER',
          'SRHR_OFFICER',
          'MEL_OFFICER',
          'FIELD_OFFICER_1',
          'FIELD_OFFICER_2',
          'YOUTH_KNOWLEDGE_HUB_OFFICER',
          'SYSTEM_ADMIN',
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

export const isGovernanceRoute = (path) => path.startsWith('/governance');
