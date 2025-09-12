# Multi-Tenant SaaS Notes App

A multi-tenant Notes application built with Next.js, PostgreSQL, and JWT authentication.

## Features

- **Multi-tenancy**: Shared database schema with tenant isolation
- **Authentication**: JWT-based login with role-based access (admin/member)
- **Authorization**: Role-based permissions and tenant isolation
- **Subscription Plans**: Free plan (3 notes max) and Pro plan (unlimited)
- **CRUD Operations**: Full notes management with tenant isolation
- **Admin Features**: Tenant upgrades and user invitations

## Tech Stack

- **Frontend**: React with Wouter routing, shadcn/ui components
- **Backend**: Express.js API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with bcryptjs password hashing
- **Development**: Node.js 18+, TypeScript, Vite

## Getting Started

### 1. Install Dependencies

```bash
npm install
