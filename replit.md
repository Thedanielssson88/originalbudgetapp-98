# Overview

This is a comprehensive budget management application built with React and TypeScript on the frontend and Express.js on the backend. The application allows users to import bank transactions, categorize expenses, create budgets, track savings goals, and analyze financial data across multiple accounts and time periods. It features sophisticated transaction matching, automated categorization rules, and detailed financial reporting capabilities.

## Recent Critical Changes (January 2025)

- **FIXED - XLSX Category Import Issue (August 2025)**: Successfully resolved critical issue where XLSX files showed "-" for bankCategory and bankSubCategory while CSV files worked correctly. Improved XLSX parsing to preserve all cell data using array-based conversion method with `defval: ''` and proper column padding. XLSX files now correctly import and display bank categories just like CSV files.
- **Google Drive Integration (August 2025)**: Implemented comprehensive cloud backup system with automatic synchronization. Users can now connect their Google Drive account for seamless data syncing between mobile and desktop devices. Features include manual backup/restore, automatic backup after data changes, and clear setup instructions for Google Drive API configuration.
- **CRITICAL FIX - Complete Export/Import System (August 2025)**: Fixed major data transfer issue where export/import didn't work properly between devices. New system exports ALL localStorage data (every key, every setting, all transactions) with mobile-optimized download methods and comprehensive logging. Users can now truly transfer complete app state between mobile and desktop with detailed verification messages.
- **Enhanced Data Export/Import**: Improved export functionality to include all localStorage data (categories, bank mappings, etc.) and added import functionality for complete data synchronization between devices.
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