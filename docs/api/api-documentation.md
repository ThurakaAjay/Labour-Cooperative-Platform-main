# WorkHive — API Specification & Reference

Base URL in development: `http://localhost:5000/api`  
Vite Proxy route: `/api/*`

All responses follow a consistent JSON envelope:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... }
}
```

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "name": "Ananya Raghavan",
    "phone": "+91 98401 12345",
    "email": "ananya@chennaimember.in",
    "password": "SecurePassword123",
    "role": "customer",
    "locality": "Ward 4, Adyar, Chennai",
    "userCategory": "household"
  }
  ```
- **Response**: `201 Created` with user profile and signed JWT token.

### 1.2 User Login
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "identifier": "+91 98401 12345",
    "password": "SecurePassword123",
    "role": "customer"
  }
  ```
- **Response**: `200 OK` with user profile and signed JWT token.

### 1.3 Send OTP
- **Method**: `POST`
- **Path**: `/api/auth/send-otp`
- **Access**: Public
- **Request Body**: `{ "phone": "+91 98401 12345" }`
- **Response**: `200 OK` with `{ expiresInSeconds: 300 }`.

### 1.4 Verify OTP
- **Method**: `POST`
- **Path**: `/api/auth/verify-otp`
- **Access**: Public
- **Request Body**: `{ "phone": "+91 98401 12345", "otp": "330116", "role": "customer" }`
- **Response**: `200 OK` with JWT session.

### 1.5 Get / Update Profile
- **Method**: `GET / PUT`
- **Path**: `/api/auth/profile`
- **Access**: Authenticated (`Bearer <token>`)

---

## 2. Worker Endpoints (`/api/workers`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/workers` | Public | List workers with query filters (`?skill=Plumbing&status=Verified&search=Ravi`) |
| `GET` | `/api/workers/:id` | Public | Get single worker by `workerId` or MongoDB `_id` |
| `POST` | `/api/workers` | Public | Register new worker profile for cooperative onboarding |
| `PUT` | `/api/workers/:id` | Authenticated | Update worker profile, verification status, or availability |
| `DELETE` | `/api/workers/:id` | Admin | Suspend or remove worker from roster |

---

## 3. Booking Endpoints (`/api/bookings`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/bookings` | Authenticated | Fetch bookings with filters (`?workerId=...&status=pending`) |
| `GET` | `/api/bookings/:id` | Authenticated | Get booking by `bookingId` |
| `POST` | `/api/bookings` | Authenticated | Create a new customer booking |
| `PUT` | `/api/bookings/:id/status` | Authenticated | Advance booking lifecycle (`pending` → `accepted` → `on_the_way` → `arrived` → `completed`) |
| `DELETE` | `/api/bookings/:id` | Authenticated | Cancel or delete booking |

---

## 4. Service Catalog Endpoints (`/api/services`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/services` | Public | List services with search and category filters |
| `GET` | `/api/services/:id` | Public | Get service details |
| `POST` | `/api/services` | Admin | Create or upsert catalog service |
| `PUT` | `/api/services/:id` | Admin | Update service details or pricing |
| `DELETE` | `/api/services/:id` | Admin | Remove service from catalog |

---

## 5. Cooperative Society Endpoints (`/api/cooperative`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/cooperative/stats` | Public | Get society pool telemetry, dividend rate, welfare escrow |
| `GET` | `/api/cooperative/proposals` | Public | List democratic voting proposals |
| `POST` | `/api/cooperative/proposals/:id/vote` | Authenticated | Cast member vote (`{ "vote": "YES" | "NO" }`) |
| `POST` | `/api/cooperative/proposals` | Admin | Create new resolution proposal |
| `GET` | `/api/cooperative/claims` | Public | Get welfare claims log |
| `POST` | `/api/cooperative/claims` | Authenticated | Submit tool/medical welfare subsidy claim |

---

## 6. Grievances & Complaints (`/api/complaints`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/complaints` | Admin | List filed complaints |
| `POST` | `/api/complaints` | Authenticated | File new grievance |
| `PUT` | `/api/complaints/:id` | Admin | Resolve complaint and optionally escalate to worker suspension |

---

## 7. Admin Operations (`/api/admin`)

*All routes under `/api/admin` strictly require an Admin JWT Bearer token.*

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Admin | Live primary administrative telemetry and revenue distribution |
| `GET` | `/api/admin/customers` | Admin | List all registered customers |
| `POST` | `/api/admin/reset-demo` | Admin | Clean-slate reset and re-seed of database (disabled in production) |

---

## 8. Health Check (`/api/health`)

- **Method**: `GET`
- **Path**: `/api/health`
- **Access**: Public (Ideal for Docker and Kubernetes liveness probes)
- **Sample Output**:
  ```json
  {
    "status": "ok",
    "service": "WorkHive Enterprise API Server",
    "database": {
      "engine": "MongoDB",
      "status": "connected",
      "connected": true
    },
    "timestamp": "2026-08-29T19:54:12.000Z"
  }
  ```
