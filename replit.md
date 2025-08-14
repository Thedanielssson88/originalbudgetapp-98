# Overview

This is a comprehensive budget management application built with React and TypeScript on the frontend and Express.js on the backend. The application allows users to import bank transactions, categorize expenses, create budgets, track savings goals, and analyze financial data across multiple accounts and time periods. It features sophisticated transaction matching, automated categorization rules, and detailed financial reporting capabilities.

## Recent Critical Changes (August 2025)

- **CRITICAL FIX - Production OAuth Authentication Resolved (August 2025)**: Successfully resolved the production authentication failure where users clicking "Allow" would cause app reload instead of completing OAuth flow:
  - **Root Cause**: REPLIT_DOMAINS environment variable was truncating the production domain from `originalbudgetapp-98-andreasadaniels.replit.app` to `originalbudgetapp-98-andreasadaniels.replit.ap`
  - **Solution**: Implemented domain detection and correction logic in `server/replitAuth.ts` to automatically fix truncated domains
  - **Result**: Production OAuth callback now works correctly with proper domain matching for authentication strategies
  - **Authentication Status**: Development uses mock user (test-user-123), Production uses full Replit OAuth with user creation in PostgreSQL database
  - **Session Management**: PostgreSQL-backed session storage with secure cookies for production HTTPS domains

## Previous Critical Changes (January 2025)

- **FIXED - Database Configuration (August 2025)**: Successfully configured proper database setup with Neon as production database:
  - Current DATABASE_URL properly points to Neon database containing 3,840 real transactions
  - Database connection correctly identifies as "production database (Neon) - your real data"  
  - Removed confusion between development and production database URLs
  - App now consistently uses the Neon database with all existing financial data
  - Database initialization and transaction loading working correctly with production data

- **CRITICAL FIX - Duplicate Account Creation Resolved (January 2025)**: Completely eliminated the duplicate "Överföring" account creation issue that was creating 10+ duplicate accounts during app initialization:
  - Disabled the `ensureOverforingAccount()` function that was automatically creating duplicate accounts during startup
  - Fixed localStorage caching in useAccounts and useTransactions hooks to prevent legacy data interference
  - Modified React Query hooks to only use SQL database data, never mixing with localStorage fallback data
  - Successfully reduced accounts from 10+ duplicates to the correct 4 accounts (Sparande, Hushållskonto, Löpande, Överföring)
  - Accounts are now ONLY imported from SQL database, eliminating all localStorage and legacy data contamination

- **CRITICAL COMPILATION FIX (January 2025)**: Successfully resolved all TypeScript compilation errors that were preventing application startup:
  - Fixed incomplete storage interface implementations in MemStorage and DatabaseStorage classes
  - Resolved type mismatches in createFamilyMember, createAccount, createTransaction, and createMonthlyBudget methods
  - Added proper default values for all required fields (createdAt timestamps, nullable fields, enum defaults)
  - Fixed method signature mismatches between interface and implementation classes
  - Corrected budget post retrieval method calls to match interface expectations
  - Application now compiles cleanly and runs without TypeScript errors
  - Server successfully starts on port 5000 with full database connectivity

- **NEW - Monthly Account Balance Database Persistence (January 2025)**: Implemented complete database persistence system for monthly account balances with automatic payday calculation:
  - Created PostgreSQL table `monthly_account_balances` with UUID primary keys and year-month format storage
  - Integrated automatic balance calculation during CSV/XLSX import to save results to database
  - Added startup logic to load stored monthly balances from database into local state
  - Account balances now persist across devices and app restarts with full cross-device synchronization
  - Payday logic (transactions before 25th) now saves calculated balances directly to database
  - System automatically loads and applies stored balances during application initialization

- **NEW - Complete UUID-Based Backend Implementation (January 2025)**: Successfully rebuilt the entire backend from scratch with PostgreSQL database and UUID-based architecture:
  - Implemented comprehensive database schema with UUID primary keys for all entities (users, huvudkategorier, underkategorier, accounts, transactions, categoryRules)
  - Created PostgreSQL database connection using Neon serverless driver with Drizzle ORM
  - Built complete database storage layer (dbStorage.ts) replacing in-memory storage
  - Implemented all CRUD operations for categories, accounts, transactions, and category rules
  - Added mock authentication middleware with userId context for all requests
  - Created React Query hooks for all entities (useCategories, useAccounts, useTransactions, useCategoryRules)
  - Successfully tested API with real UUID-based categories and subcategories
  - Backend automatically uses PostgreSQL when DATABASE_URL is available, falls back to in-memory storage for development
  - All relationships now use UUIDs instead of string-based identifiers, eliminating naming conflicts

- **NEW - UUID-Based Category System (August 2025)**: Implemented comprehensive UUID-based category system replacing string-based category identifiers. This major refactoring includes:
  - Complete database schema with `huvudkategorier` and `underkategorier` tables using UUID primary keys
  - Category migration service to convert existing localStorage categories to UUID system
  - New category management UI with hierarchical category display and CRUD operations
  - React hooks for category management with TanStack Query integration
  - Migration dialog to guide users through the upgrade process
  - Backward compatibility during transition period
  - Enhanced data integrity and eliminates naming conflicts
  - Categories are now database-persisted with proper foreign key relationships
  - Route `/kategorier` added for category management interface
- **COMPREHENSIVE UUID MIGRATION SYSTEM (August 2025)**: Implemented complete migration infrastructure to resolve category renaming issues and enable safe UUID-based category system. Features include:
  - Database clearing functionality for fresh migration starts  
  - Comprehensive migration API that imports ALL localStorage data (categories, transactions, rules)
  - UUID-based category rule hooks to eliminate localStorage/UUID conflicts on Rules page
  - Reset migration functionality for easy re-migration if needed
  - Complete fix for issue where subcategories disappeared when renaming main categories
- **FIXED - XLSX Category Import Issue (August 2025)**: Successfully resolved critical issue where XLSX files showed "-" for bankCategory and bankSubCategory while CSV files worked correctly. Implemented comprehensive fix including:
  - Corrected sammanfogningslogik in `budgetOrchestrator.ts` to always preserve bankCategory/bankSubCategory from import files for ALL existing transactions
  - Enhanced UI with four distinct columns: Bankkategori (file data), Bankunderkategori (file data), Huvudkategori (App), Underkategori (App) 
  - Bank categories now displayed with blue background to distinguish from app categories
  - Manual transaction changes preserved while bank data always updated from files
  - XLSX files now correctly import and display bank categories with complete transparency
- **Google Drive Integration (August 2025)**: Implemented comprehensive cloud backup system with automatic synchronization. Users can now connect their Google Drive account for seamless data syncing between mobile and desktop devices. Features include manual backup/restore, automatic backup after data changes, and clear setup instructions for Google Drive API configuration.
- **CRITICAL FIX - Complete Export/Import System (August 2025)**: Fixed major data transfer issue where export/import didn't work properly between devices. New system exports ALL localStorage data (every key, every setting, all transactions) with mobile-optimized download methods and comprehensive logging. Users can now truly transfer complete app state between mobile and desktop with detailed verification messages.
- **Enhanced Data Export/Import**: Improved export functionality to include all localStorage data (categories, bank mappings, etc.) and added import functionality for complete data synchronization between devices.
- **UUID Category Architecture**: Migrated from string-based to UUID-based category system with database persistence, providing better data integrity and safe category renaming capabilities.
- **Centralized Transaction Storage**: Implemented a single source of truth for all transactions in `budgetState.allTransactions` to fix critical data loss issues when switching between months. Transactions are no longer stored separately per month but in a central array, with filtering applied as needed for display.
- **Account Display Fix**: Fixed account dropdown to preserve full account objects with IDs instead of just names, ensuring proper display of account names throughout the application.
- **Savings by Account Section**: Added a new "Sparande per konto" (Savings by Account) section in the summary view that shows all accounts with their associated savings transactions, similar to how "Totala kostnader" works but for savings. This replaces the misplaced "Överföringar" tab that was incorrectly nested under "Totalt sparande".

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

- **Framework**: React 18 with TypeScript and Vite for build tooling
- **UI Components**: Extensive use of Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for theming and responsive design
- **State Management**: Custom orchestrator pattern with global state management through `budgetOrchestrator.ts`
- **Routing**: Wouter for lightweight client-side routing
- **Data Fetching**: TanStack Query for server state management and caching

## Backend Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL session store
- **Development**: Vite integration for hot module replacement in development

## Key Architectural Patterns

- **Orchestrator Pattern**: Centralized business logic through `budgetOrchestrator.ts` that manages all state mutations and calculations
- **Service Layer**: Separation of concerns with dedicated services for calculations, storage, and utilities
- **Component Composition**: Modular UI components with clear prop interfaces and reusable patterns
- **Type Safety**: Comprehensive TypeScript types for budget data, transactions, and UI components

## Data Storage Solutions

- **Primary Database**: PostgreSQL for production data persistence
- **Local Storage**: Browser localStorage for user preferences and cached data
- **In-Memory Storage**: Development fallback storage implementation for local development
- **File Processing**: CSV import and parsing capabilities for bank transaction data

## Key Features

- **Transaction Import**: Multi-bank CSV import with intelligent column mapping and duplicate detection
- **Automated Categorization**: Rule-based transaction categorization with bank category mapping
- **Budget Management**: Monthly budget creation with templates and historical data analysis
- **Transfer Matching**: Intelligent matching of internal transfers between accounts
- **Savings Tracking**: Goal-based savings tracking with progress visualization
- **Account Analysis**: Multi-account balance tracking and projection
- **Mobile Responsive**: Touch-friendly interface with swipe gestures and mobile debugging tools

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL provider for production database hosting
- **Drizzle ORM**: Type-safe database operations and schema management

## UI Libraries
- **Radix UI**: Headless UI primitives for accessibility and behavior
- **shadcn/ui**: Pre-built component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Recharts**: Chart library for financial data visualization

## Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production builds

## Utility Libraries
- **date-fns**: Date manipulation and formatting
- **uuid**: Unique identifier generation
- **clsx**: Conditional className utilities
- **wouter**: Lightweight routing library

## Form Management
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for forms and data