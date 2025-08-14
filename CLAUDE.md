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

## Transaction Field Management (CRITICAL)

### Common Issue: New transaction fields not displaying in UI
When adding new fields to transactions (like `linkedCostId`, `correctedAmount`, etc.), the data flow is complex and requires updates in multiple places. Missing any step will cause fields to disappear.

### Required Fixes for New Transaction Fields

#### 1. Backend Data Retrieval (`server/dbStorage.ts`)
**CRITICAL**: Never use explicit column selection in bulk queries with Drizzle ORM
```typescript
// ❌ WRONG - Fields will be missing/null
const result = await db.select({
  id: transactions.id,
  newField: transactions.newField,
}).from(transactions)

// ✅ CORRECT - All fields included
const result = await db.select().from(transactions)
```

#### 2. Transaction Processing Pipeline (`budgetOrchestrator.ts`)
**CRITICAL**: Search for ALL `.map(tx => ({` patterns and add new fields to every conversion:

- `forceReloadTransactions()` around line 1960
- `setTransactionsForMonth()` around line 3260  
- Any other ImportedTransaction → Transaction conversions

```typescript
// Must add new field in ALL conversion points
const transactionsAsBaseType: Transaction[] = transactions.map(tx => ({
  id: tx.id,
  linkedTransactionId: tx.linkedTransactionId,
  linkedCostId: tx.linkedCostId,           // Example existing field
  savingsTargetId: tx.savingsTargetId,     // Example existing field 
  newField: tx.newField,                   // NEW FIELD - Add everywhere
  correctedAmount: tx.correctedAmount,
}))
```

#### 3. Transaction Linking Functions (`budgetOrchestrator.ts`)
**CRITICAL**: Update ALL linking functions to set new fields:
- `linkExpenseAndCoverage()`
- `coverCost()`
- `applyExpenseClaim()`
- Any other functions that create transaction relationships

```typescript
// Example: linkExpenseAndCoverage function
updates: {
  type: 'ExpenseClaim',
  correctedAmount: newNegativeCorrectedAmount,
  linkedTransactionId: positiveTxId,
  linkedCostId: positiveTxId,         // Existing relationship field
  newField: newValue,                 // NEW FIELD - Add to updates
  isManuallyChanged: true
}
```

#### 4. Frontend Snake_case Conversion (`TransactionExpandableCard.tsx`)
**CRITICAL**: Add snake_case → camelCase conversion for database compatibility
```typescript
// In useEffect conversion logic
let newField = propTransaction.newField || (propTransaction as any).new_field || null;

const convertedTransaction = {
  ...propTransaction,
  newField: newField,  // Add converted field
}
```

### Checklist for New Transaction Fields

- [ ] Add field to database schema (`shared/schema.ts`)
- [ ] Verify backend uses `select()` not `select({specific})` in `dbStorage.ts`
- [ ] Search for ALL `.map(tx => ({` in `budgetOrchestrator.ts` and add field everywhere
- [ ] Update ALL transaction linking functions to set the new field
- [ ] Add snake_case → camelCase conversion in `TransactionExpandableCard.tsx`
- [ ] Test both new transactions AND existing transactions work
- [ ] If old transactions have null values, consider adding a frontend workaround

### Why This Is Complex
1. **Multiple data conversion points**: Data passes through DB → API → Orchestrator → State → UI
2. **Drizzle ORM quirks**: Explicit column selection can fail silently
3. **Legacy compatibility**: Old transactions may need workarounds
4. **Snake_case vs camelCase**: Database uses snake_case, frontend uses camelCase

### Example: linkedCostId Fix (January 2025)
This exact issue occurred with `linkedCostId` and `correctedAmount` fields for ExpenseClaim/CostCoverage transactions. Required fixes at:
1. `server/dbStorage.ts` - Switch to `select()` from explicit columns
2. `budgetOrchestrator.ts:3274` - Add `linkedCostId` to transaction conversion
3. `budgetOrchestrator.ts:3209` - Add `linkedCostId` to linking updates  
4. `TransactionExpandableCard.tsx:80` - Extend workaround for ExpenseClaim

## Development Best Practices

- **Always use UUIDs**: Never string-based entity lookups
- **Orchestrator Pattern**: All mutations through `budgetOrchestrator.ts`
- **Real Data Testing**: Test imports with actual Swedish bank CSV/XLSX files
- **Payday Validation**: Verify 25th-of-month balance calculations
- **TanStack Query**: Use for all server state management
- **Mock Auth**: `dev-user-123` automatically injected in development