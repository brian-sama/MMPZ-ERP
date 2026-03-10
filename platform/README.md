# Unified Enterprise Platform

This folder contains the production target architecture for the ERP + Intranet platform.

## Directories

- `frontend`: React + Vite portal UI
- `backend`: Django + DRF + Channels backend
- `database`: schema and migration guidance
- `uploads`: managed file storage paths
- `scripts`: automation, deployment, and migration scripts
- `docs`: architecture and operations documentation

## Quick Start

1. Configure `.env` at repo root.
2. Backend setup:
   - `platform/scripts/bootstrap_backend.ps1`
3. Frontend setup:
   - `platform/scripts/bootstrap_frontend.ps1`
