# Database Layer

This platform uses PostgreSQL with Django migrations as the primary schema source.

## Main Groups

- Access control: users, roles, permissions, role_permissions, user_roles
- Membership: members, membership_categories, attendance, contributions
- Finance: transactions, donations, expenses, budgets, financial_reports
- Assets: assets, asset_locations, asset_maintenance, asset_depreciation
- Inventory: inventory_items, stock_movements, suppliers, purchase_orders
- Intranet: announcements, documents, document_versions, events, messages, directories, knowledge_articles
- System: audit_logs, notifications, system_events

## Migration Workflow

1. `python manage.py makemigrations`
2. `python manage.py migrate`
3. For legacy environments with existing tables, use `platform/scripts/reconcile_django_migrations.ps1`.
