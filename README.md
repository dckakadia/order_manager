# Mivox Spas - Order Manager

A comprehensive full-stack application for managing spa orders, tracking production pipeline stages, and generating metric reports.

## Architecture

- **Frontend**: React (Vite)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (managed via Prisma ORM)
- **Mobile**: Android APK built with Capacitor
- **Real-time**: Socket.IO for live order sync across clients
- **Security**: 
  - HttpOnly Cookie-based Authentication (JWT)
  - CSRF Protection (Double Submit Cookie Pattern)
  - Role-Based Access Control (RBAC)

## Project Structure

- `/frontend` - React application
- `/backend` - Express API, Prisma schema, and WebSocket server
- `/android` - Capacitor generated Android project

## Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL (v14+ recommended)
- Android Studio (for building the mobile APK)

## Setup & Local Development

1. **Install Dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Database Setup**
   Ensure PostgreSQL is running and accessible. Configure your `.env` file in the `/backend` directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/ordermanager?schema=public"
   JWT_SECRET="your_secure_random_string_min_32_chars"
   PORT=3001
   ALLOWED_ORIGINS="http://localhost:5173"
   ```
   
   Run migrations and seed the database:
   ```bash
   cd backend
   npx prisma migrate dev
   npm run seed
   ```

3. **Run the Application**
   Open two terminals:
   
   Terminal 1 (Backend):
   ```bash
   cd backend
   npm run dev
   ```
   
   Terminal 2 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```

## Production Deployment

### Backend (Ubuntu / PM2)
1. Ensure Nginx is configured to proxy `/api` requests to port `3001` and handle WebSocket upgrades.
2. Start the backend process using PM2:
   ```bash
   pm2 start server.js --name "mivox-spas-api"
   pm2 save
   ```

### Frontend (Static Hosting)
Build the frontend for production:
```bash
cd frontend
npm run build
```
Copy the contents of `frontend/dist` to your web server's static directory.

### Mobile App (Android)
To build the Android application:
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
```
Use Android Studio to generate the signed APK.

## Features & Roles

- **Admin (e.g., Devin)**: Full access. Can create users, items, manually edit/delete orders, restore from backup, and view all metrics.
- **Manager (e.g., Paresh)**: Can advance/reverse order statuses in the pipeline.
- **Sales (e.g., Manish)**: Can create new orders, view their submitted orders, and check in with geolocation.

## Security Overview
- **Authentication**: JWTs are stored in HttpOnly, secure cookies. The frontend relies on these cookies and `credentials: 'include'` for all requests.
- **CSRF**: A unique `csrf_token` cookie is generated on load. State-changing requests must include the `x-csrf-token` header matching the cookie.
- **Auditing**: Sensitive actions (logins, order deletions) are logged.
