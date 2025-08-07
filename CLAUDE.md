# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev       # Start development server (port 5000)
npm run build     # Build for production (Vite + esbuild)
npm run start     # Start production server
npm run check     # TypeScript type checking
npm run db:push   # Push Drizzle schema changes to PostgreSQL
```

## Architecture Overview

Full-stack budget management app with PostgreSQL, Express.js backend, and React frontend.

### Tech Stack
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless)
- **Backend**: Express.js with TypeScript, mock auth (dev-user-123)
- **Frontend**: React + TypeScript + TanStack Query + shadcn/ui
- **Build**: Vite (frontend) + esbuild (backend)

### Key Directories
- `server/` - Express backend with API routes
- `client/` - React frontend application
- `shared/` - Shared schemas and types (Drizzle + Zod)

## Database Architecture

All entities use UUID primary keys. Key tables:
- `users`, `familyMembers` - User management
- `accounts` - Financial accounts with bank mapping
- `transactions` - UUID-categorized transactions
- `huvudkategorier`, `underkategorier` - Category hierarchy
- `categoryRules` - Auto-categorization rules
- `monthlyBudgets`, `budgetPosts` - Budget configs
- `monthlyAccountBalances` - Payday-based balances (25th)

## Core Systems

### State Management
- **Orchestrator Pattern**: `client/src/orchestrator/budgetOrchestrator.ts` manages all state mutations
- **Single Source of Truth**: `budgetState.allTransactions` stores all transactions
- **TanStack Query**: Server state management with React hooks in `client/src/hooks/`

### Transaction Import Flow
1. CSV/XLSX parsed via `importAndReconcileFile()`
2. Column mapping stored in `bankCsvMappings`
3. Smart merge prevents duplicates
4. Balance calculation (25th payday logic)
5. UUID-based categorization applied
6. PostgreSQL persistence with audit trail

### Category System
- UUID-based to eliminate naming conflicts
- Migration service converts legacy string categories
- Hierarchical: huvudkategorier → underkategorier
- Full CRUD operations via `/kategorier` route

## API Endpoints

All routes in `server/routes.ts` with mock auth middleware:
- Categories: `/api/huvudkategorier`, `/api/underkategorier`
- Accounts: `/api/accounts`
- Transactions: `/api/transactions`
- Rules: `/api/category-rules`
- Budgets: `/api/monthly-budgets`, `/api/budget-posts`
- Balances: `/api/monthly-account-balances`

## Environment Variables

```bash
DATABASE_URL  # PostgreSQL connection (falls back to in-memory if not set)
PORT         # Server port (default: 5000)
```

## Critical Implementation Notes

### UUID Migration (January 2025)
- All entities migrated from string to UUID identifiers
- Category migration dialog guides users through upgrade
- Backward compatibility maintained during transition

### Monthly Balance Persistence
- Balances calculated on 25th (payday)
- Stored in PostgreSQL with month-key format (YYYY-MM)
- Auto-loaded on app startup for cross-device sync

### Import System
- Supports CSV/XLSX with encoding cleanup
- Bank-specific column mappings persisted
- Intelligent reconciliation prevents duplicates

## Adding New Features

### New Database Table
1. Define schema in `shared/schema.ts`
2. Add Zod validators
3. Implement CRUD in `server/dbStorage.ts`
4. Create routes in `server/routes.ts`
5. Build React hook in `client/src/hooks/`

### New Page
1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add nav item in `client/src/components/AppSidebar.tsx`

### Transaction Processing
- Core logic: `client/src/orchestrator/budgetOrchestrator.ts`
- Import UI: `client/src/components/TransactionImportEnhanced.tsx`
- Calculations: `client/src/services/calculationService.ts`

## Development Guidelines

- Always use UUID operations, never string-based lookups
- All mutations through orchestrator pattern
- Test imports with real bank CSV/XLSX files
- Validate payday calculations (25th of month)
- Use TanStack Query for server state
- Mock userId: `dev-user-123` injected automatically