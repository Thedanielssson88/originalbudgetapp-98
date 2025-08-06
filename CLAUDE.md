# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start development server:**
```bash
npm run dev
```

**Build application:**
```bash
npm run build
```

**Type checking:**
```bash
npm run check
```

**Database operations:**
```bash
npm run db:push  # Push schema changes to database
```

**Production start:**
```bash
npm start
```

**Package Management:**
- Project uses npm with package-lock.json
- Dependencies include React 18, Express 4, Drizzle ORM, shadcn/ui components
- TypeScript 5.6.3 with strict type checking enabled

## Application Architecture

This is a full-stack budget management application with PostgreSQL database, Express.js backend, and React frontend.

### Project Structure
- `server/` - Express.js backend with Drizzle ORM
- `client/` - React frontend with TypeScript  
- `shared/` - Shared TypeScript schemas and types
- `attached_assets/` - User-uploaded files and debug assets

### Database Schema
The application uses PostgreSQL with UUID-based entities managed through Drizzle ORM:
- `users` - User accounts (mock auth with dev-user-123)
- `familyMembers` - Household user management with UUID keys
- `accounts` - Financial accounts with bank template mapping and family member assignment
- `transactions` - Bank transactions with UUID-based categorization and full audit trail
- `huvudkategorier` / `underkategorier` - UUID-based category hierarchy system (eliminates naming conflicts)
- `categoryRules` - Automated transaction categorization rules with UUID category references
- `monthlyBudgets` / `budgetPosts` - Monthly budget configurations with UUID relationships
- `monthlyAccountBalances` - Payday-based balance tracking (25th of each month)
- `banks` / `bankCsvMappings` - Bank import configuration with column mapping persistence

**Critical Schema Features:**
- All entities use UUID primary keys to eliminate conflicts
- Foreign key relationships ensure data integrity
- Month-based partitioning for balance calculations
- User isolation through userId foreign keys

### Key Backend Files
- `server/index.ts` - Main server entry point with middleware setup
- `server/routes.ts` - API routes and request handling
- `server/dbStorage.ts` - PostgreSQL database operations
- `server/storage.ts` - In-memory storage (development fallback)
- `shared/schema.ts` - Drizzle schema definitions and Zod validators

### Frontend Architecture
- **State Management**: Custom orchestrator pattern (`client/src/orchestrator/budgetOrchestrator.ts`)
- **Data Fetching**: TanStack Query hooks in `client/src/hooks/`
- **UI Components**: shadcn/ui components in `client/src/components/ui/`
- **Pages**: Main application pages in `client/src/pages/`
- **Services**: Business logic services in `client/src/services/`

### Key Features
- **Transaction Import**: CSV/XLSX import with column mapping
- **Category Management**: UUID-based hierarchical categories
- **Budget Planning**: Monthly budgets with templates
- **Account Tracking**: Multi-account balance management
- **Rule Engine**: Automated transaction categorization
- **Monthly Balance Tracking**: Automatic payday-based balance calculation

## Development Guidelines

### Database Configuration
- Requires `DATABASE_URL` environment variable for PostgreSQL
- Falls back to in-memory storage for development without database
- Use `npm run db:push` to sync schema changes

### Mock Authentication
- Development uses mock userId: `dev-user-123`
- All API requests automatically inject this userId
- Production would replace with proper authentication middleware

### Import System
- Supports CSV and XLSX bank transaction files
- Column mapping stored in `bankCsvMappings` table
- Bank categories preserved separately from app categories

### Category System
- UUID-based categories eliminate naming conflicts
- Migration system converts legacy string-based categories
- Categories have hierarchy: `huvudkategorier` -> `underkategorier`

### State Management Architecture
- **Central Orchestrator**: `budgetOrchestrator.ts` manages all state mutations and calculations
- **Single Source of Truth**: All transactions stored in `budgetState.allTransactions`
- **Month-based Filtering**: Display logic filters centralized transaction array
- **Smart Merge Logic**: CSV import uses intelligent reconciliation to prevent duplicates
- **Real-time Updates**: UI automatically refreshes on state changes
- **Hybrid Storage**: PostgreSQL backend with localStorage fallback for development
- **State Persistence**: TanStack Query for server state, localStorage for client state
- **Mobile Debug System**: Comprehensive logging system for troubleshooting mobile issues

### Transaction Processing Flow
1. **CSV/XLSX Import**: Files parsed through `importAndReconcileFile()` function with encoding cleanup
2. **Column Mapping**: Bank-specific CSV mapping stored in `bankCsvMappings` table
3. **Data Reconciliation**: Smart merge compares file data with existing transactions using multiple criteria
4. **Balance Calculation**: Monthly account balances calculated based on payday logic (25th of month)
5. **Category Application**: UUID-based rules engine applies categorization automatically
6. **Database Persistence**: All changes committed to PostgreSQL with audit trail
7. **UI Refresh**: TanStack Query invalidation triggers component re-renders

### Build Process
- Frontend built with Vite to `dist/public/`
- Backend bundled with esbuild to `dist/`
- Development uses Vite HMR integration
- Single port (5000) serves both API and static files

## Common Development Tasks

**Add new database table:**
1. Define schema in `shared/schema.ts`
2. Create insert/select schemas with Zod
3. Add CRUD operations to `server/dbStorage.ts`
4. Create API routes in `server/routes.ts`
5. Build React hooks in `client/src/hooks/`

**Add new page:**
1. Create component in `client/src/pages/`
2. Add route to `client/src/App.tsx`
3. Add navigation item to `client/src/components/AppSidebar.tsx`

**Modify transaction processing:**
- Core business logic in `client/src/orchestrator/budgetOrchestrator.ts`
- Import UI logic in `client/src/components/TransactionImport.tsx`
- Category migration in `client/src/services/categoryMigrationService.ts`
- Calculation services in `client/src/services/calculationService.ts`

**Working with the Orchestrator:**
- All transaction mutations must go through the orchestrator
- Use `importAndReconcileFile()` for CSV/XLSX imports
- State changes automatically trigger UI updates
- Debug logging available through mobile debug utilities

## Environment Setup
- Application runs on port 5000 (both development and production)  
- Requires Node.js with npm (project uses ES modules)
- PostgreSQL database via `DATABASE_URL` (uses Neon serverless by default)
- Drizzle Kit for database schema management
- Optional: Google Drive API credentials for cloud backup
- Development uses Vite with HMR and esbuild for backend bundling
- Production serves static files and API from single Express server

## Critical Implementation Notes

### Recent Major Changes (January 2025)
- **Complete UUID Migration**: All entities migrated from string-based to UUID-based identifiers
- **Database Persistence**: Monthly account balances now persist in PostgreSQL
- **Enhanced Import System**: Improved CSV/XLSX handling with better encoding support
- **TypeScript Compilation**: All compilation errors resolved, clean build process

### Development Priorities
- Always use UUID-based category operations, never string-based lookups
- Ensure all database operations go through the orchestrator pattern
- Test import functionality with real bank CSV/XLSX files
- Validate monthly balance calculations match payday logic (25th of month)
- Use TanStack Query for all server state management

## Key Files for Understanding
- `replit.md` - Comprehensive project overview and recent changes
- `shared/schema.ts` - Complete database schema with UUID relationships and foreign keys
- `client/src/orchestrator/budgetOrchestrator.ts` - Core business logic and state management
- `server/dbStorage.ts` - PostgreSQL operations with UUID-based queries
- `server/routes.ts` - API endpoints with mock authentication middleware
- `client/src/state/budgetState.ts` - Central state definition and persistence
- `client/src/services/categoryMigrationService.ts` - UUID migration and data conversion