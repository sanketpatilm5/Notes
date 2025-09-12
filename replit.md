# Multi-Tenant SaaS Notes Application

## Overview

This is a multi-tenant SaaS Notes application built with React/Express.js and PostgreSQL. The application supports multiple organizations (tenants) sharing the same database with proper data isolation. Each tenant can have multiple users with role-based access control, and subscription plans that limit features. The system includes JWT-based authentication, CRUD operations for notes, and admin features like user invitations and plan upgrades.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with Vite for development and building
- **Routing**: Wouter for client-side routing (lightweight React Router alternative)
- **UI Components**: shadcn/ui component library with Radix UI primitives and Tailwind CSS
- **State Management**: TanStack React Query for server state management
- **Authentication**: JWT tokens stored in localStorage with manual token validation
- **Styling**: Tailwind CSS with custom theme configuration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT with bcryptjs for password hashing
- **API Structure**: RESTful endpoints with CORS support
- **Multi-tenancy**: Shared database schema with tenant isolation via tenant_id columns
- **Authorization**: Role-based access control (admin/member roles per tenant)

### Database Schema
- **Multi-tenant Design**: Shared schema approach with three main tables:
  - `tenants`: Organizations with subscription plans (free/pro)
  - `users`: User accounts linked to tenants with roles
  - `notes`: User-generated content with tenant isolation
- **Data Isolation**: All tenant-specific data includes tenant_id for proper isolation
- **Subscription Logic**: Free plan limited to 3 notes per tenant, Pro plan unlimited

### Authentication & Authorization
- **JWT Implementation**: Tokens contain userId, email, role, tenantId, and tenantSlug
- **Role System**: Admin users can invite new users and upgrade tenant plans
- **Route Protection**: Middleware validates JWT tokens on protected API endpoints
- **Tenant Isolation**: All operations automatically filtered by user's tenant_id

### API Endpoints
- **Authentication**: POST /api/auth/login
- **Notes CRUD**: GET/POST/PUT/DELETE /api/notes with tenant isolation
- **Admin Operations**: POST /api/tenants/[slug]/invite, POST /api/tenants/[slug]/upgrade
- **Health Check**: GET /api/health and GET /health (with Vercel rewrite)

## External Dependencies

### Database
- **PostgreSQL**: Primary database using Neon serverless PostgreSQL
- **Connection**: Uses @neondatabase/serverless with WebSocket support

### Authentication & Security
- **JWT**: jsonwebtoken library for token generation and validation
- **Password Hashing**: bcryptjs for secure password storage
- **CORS**: Manual CORS headers for cross-origin requests

### UI Libraries
- **Component System**: Extensive shadcn/ui component collection
- **Icons**: Lucide React for consistent iconography
- **Form Handling**: React Hook Form with Zod validation
- **Notifications**: Custom toast system using Radix UI primitives

### Development Tools
- **Build System**: Vite with TypeScript support
- **Database Management**: Drizzle Kit for migrations and schema management
- **Runtime**: Node.js 18+ with ESM modules
- **Development**: tsx for TypeScript execution in development

### Deployment Configuration
- **Vercel**: Configured for serverless deployment with rewrites
- **Replit**: Development environment support with custom plugins
- **Environment**: Supports both development and production builds