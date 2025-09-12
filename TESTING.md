# Testing Guide

This document provides testing instructions and curl commands for the Notes SaaS application.

## Prerequisites

1. Ensure the application is running: `npm run dev`
2. Database has been seeded: `npm run seed`
3. Application is accessible at `http://localhost:5000`

## Test Flow

### 1. Health Check

```bash
curl -X GET http://localhost:5000/api/health
