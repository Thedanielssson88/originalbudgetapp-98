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
- `accounts` - Financial accounts (checking, savings, etc.)
- `transactions` - Bank transactions with categorization
- `huvudkategorier` / `underkategorier` - Category hierarchy system
- `categoryRules` - Automated transaction categorization rules
- `monthlyBudgets` - Monthly budget configurations
- `budgetPosts` - Individual budget line items
- `monthlyAccountBalances` - Monthly account balance tracking
- `banks` / `bankCsvMappings` - Bank import configuration

### Key Backend Files
- `server/index.ts` - Main server entry point
- `server/routes.ts` - API routes and request handling
- `server/storage.ts` - In-memory storage (development fallback)
- `server/dbStorage.ts` - PostgreSQL database operations
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

### State Management
- Central orchestrator manages all state mutations
- Transactions stored in `budgetState.allTransactions`
- Month-based filtering applied for display

### Build Process
- Frontend built with Vite to `dist/public/`
- Backend bundled with esbuild to `dist/`
- Development uses Vite HMR integration

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
- Business logic lives in `client/src/orchestrator/budgetOrchestrator.ts`
- Import logic in `client/src/components/TransactionImport.tsx`
- Category rules in `client/src/services/categoryMigrationService.ts`

## Environment Setup
- Application runs on port 5000 (both development and production)  
- Requires Node.js with npm
- Optional: PostgreSQL database (uses Neon serverless by default)
- Optional: Google Drive API credentials for cloud backup

## Key Files for Understanding
- `replit.md` - Comprehensive project overview and recent changes
- `shared/schema.ts` - Complete database schema
- `client/src/orchestrator/budgetOrchestrator.ts` - Core business logic
- `server/routes.ts` - API endpoints and request handling