# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev       # Start development server with tsx (port 5000)
npm run build     # Build for production (Vite frontend + esbuild backend)
npm run start     # Start production server from dist/
npm run check     # TypeScript type checking
npm run db:push   # Push Drizzle schema changes to PostgreSQL
```

## Architecture Overview

Full-stack Swedish budget management application with PostgreSQL backend and React frontend.

### Tech Stack
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless), schema in `shared/schema.ts`
- **Backend**: Express.js + TypeScript, mock auth (`dev-user-123`)
- **Frontend**: React + TypeScript + TanStack Query + shadcn/ui + Wouter routing
- **Build**: Vite (frontend) + esbuild (backend)
- **State**: Orchestrator pattern + TanStack Query for server state

### Key Directories
- `server/` - Express backend (`index.ts`, `routes.ts`, `dbStorage.ts`)
- `client/src/` - React frontend application
- `shared/` - Drizzle schemas and Zod validators
- `client/src/orchestrator/` - Core state management logic
- `client/src/hooks/` - TanStack Query hooks for API operations

## Database Architecture

UUID-based entities with Drizzle ORM. Critical tables:
- `users`, `familyMembers` - Multi-user household support
- `accounts` - Bank accounts with CSV import mappings
- `transactions` - Central transaction storage with UUID categories
- `huvudkategorier`, `underkategorier` - Swedish category hierarchy
- `categoryRules` - Auto-categorization engine
- `monthlyBudgets`, `budgetPosts` - Monthly budget configurations
- `monthlyAccountBalances` - Payday-calculated balances (25th monthly)
- `bankCsvMappings` - Persistent column mappings for bank imports

## Core Systems

### State Management Architecture
- **Orchestrator Pattern**: `client/src/orchestrator/budgetOrchestrator.ts` - Central state mutations
- **Budget State**: `client/src/state/budgetState.ts` - Single source of truth with `allTransactions`
- **TanStack Query**: Server state with React hooks in `client/src/hooks/`
- **API Store**: `client/src/store/apiStore.ts` - API operation coordination

### Transaction Import System
1. **File Processing**: CSV/XLSX via `TransactionImportEnhanced.tsx`
2. **Column Mapping**: Stored in `bankCsvMappings` table per bank
3. **Smart Reconciliation**: Duplicate detection and merge logic
4. **Balance Calculation**: Swedish payday logic (25th of month)
5. **Auto-Categorization**: UUID-based rules via `categoryRules`
6. **Persistence**: PostgreSQL with full audit trail

### Category Management
- **UUID-Based**: Eliminates naming conflicts, full migration from legacy strings
- **Hierarchical**: `huvudkategorier` → `underkategorier` structure  
- **Migration Service**: `categoryMigrationService.ts` handles legacy upgrades
- **CRUD Operations**: Full management via `/api/huvudkategorier` routes

## API Routes (`server/routes.ts`)

Mock auth middleware injects `dev-user-123` for all routes:
- **Bootstrap**: `/api/bootstrap` - Initial app data load
- **Categories**: `/api/huvudkategorier`, `/api/underkategorier` 
- **Accounts**: `/api/accounts` - Bank account management
- **Transactions**: `/api/transactions`, `/api/transactions/synchronize`
- **Rules**: `/api/category-rules` - Auto-categorization rules
- **Budgets**: `/api/monthly-budgets`, `/api/budget-posts`
- **Balances**: `/api/monthly-account-balances` - Payday balance tracking
- **Import**: `/api/banks`, `/api/bank-csv-mappings`

## Environment Setup

```bash
DATABASE_URL  # PostgreSQL connection (required for production)
PORT         # Server port (default: 5000)
NODE_ENV     # development/production
```

## Critical Implementation Details

### UUID Migration (2025)
- Complete migration from string-based to UUID identifiers
- `CategoryMigrationDialog.tsx` guides users through upgrade
- Backward compatibility during transition period

### Swedish Payday Logic
- Monthly balances calculated on 25th (Swedish payday standard)
- `monthlyAccountBalances` table stores calculated vs actual vs bank balances
- Month keys format: `YYYY-MM`

### Intelligent Import System
- Multi-format support (CSV/XLSX) with encoding detection
- Bank-specific column mappings with persistent storage
- Reconciliation prevents duplicate transactions
- Real-time balance calculation and verification

## Adding New Features

### Database Changes
1. Add table schema in `shared/schema.ts` with UUID primary key
2. Create Zod insert/select schemas with proper validation
3. Implement CRUD operations in `server/dbStorage.ts`
4. Add API routes in `server/routes.ts` with mock auth
5. Create TanStack Query hook in `client/src/hooks/`

### Frontend Pages
1. Create component in `client/src/pages/`
2. Add route to `client/src/App.tsx` Switch component
3. Add navigation item in `client/src/components/AppSidebar.tsx`

### Transaction Processing
- **Core Logic**: `budgetOrchestrator.ts` - All state mutations
- **Import UI**: `TransactionImportEnhanced.tsx` - File upload and mapping
- **Calculations**: `client/src/services/calculationService.ts` - Balance logic

## Development Best Practices

- **Always use UUIDs**: Never string-based entity lookups
- **Orchestrator Pattern**: All mutations through `budgetOrchestrator.ts`
- **Real Data Testing**: Test imports with actual Swedish bank CSV/XLSX files
- **Payday Validation**: Verify 25th-of-month balance calculations
- **TanStack Query**: Use for all server state management
- **Mock Auth**: `dev-user-123` automatically injected in development