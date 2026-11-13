# WorkHive — Local Development Setup Guide

This guide describes how to run and develop WorkHive on your local machine.

---

## 1. Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20.x` recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or Docker MongoDB. (If local MongoDB is not running, the application can fall back to an in-memory MongoDB in development when `ALLOW_IN_MEMORY_DB=true`).

---

## 2. Quick Start

### Step 1: Install Dependencies
From the repository root:
```bash
npm run install:all
```
This installs dependencies for the root workspace, the `server`, and the `client`.

### Step 2: Configure Environment Variables
Copy the example configuration:
```bash
cp server/.env.example server/.env
```
Default configuration values for development:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/workhive
ALLOW_IN_MEMORY_DB=true
JWT_SECRET=workhive_cooperative_secret_key_2026
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

### Step 3: Run the Application
Start the backend server and frontend development server concurrently or in separate terminals:

**Terminal 1 (Backend API):**
```bash
npm run server
# Runs on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
npm run client
# Runs on http://localhost:5173
```

---

## 3. Running Automated Tests

Run the complete test suite:
```bash
# Jest security & authentication unit/integration test suite
npm run test

# Master full-stack 41-step audit (across Customer, Worker, Admin)
node server/scripts/testMasterAudit.js
```

---

## 4. Default Seed Accounts

The platform automatically seeds initial data on startup:

| Role | Email / Identifier | Password | Access URL |
|---|---|---|---|
| **Admin** | `admin@chennailabour.coop` | `cooperative2026` | `http://localhost:5173/admin/login` |
| **Worker** | `+91 98401 12345` | Set during registration | `http://localhost:5173/worker/login` |
| **Customer** | Mobile number | Set during registration | `http://localhost:5173/customer/login` |
