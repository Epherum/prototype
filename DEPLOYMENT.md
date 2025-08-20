# ERP Application Local Deployment Guide

This guide covers how to run your Next.js ERP application locally on a Windows machine accessible via RDP from your office.

## Table of Contents
1. [Simple Docker Setup (Recommended)](#simple-docker-setup-recommended)
2. [Alternative: Direct Node.js Setup](#alternative-direct-nodejs-setup)
3. [Troubleshooting](#troubleshooting)

## Simple Docker Setup (Recommended)

This is the easiest way to get your ERP application running locally with minimal setup.

### Prerequisites
- Windows 10/11 or Windows Server
- At least 4GB RAM
- Docker Desktop for Windows

### Step 1: Install Docker Desktop

1. **Download Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/)
2. **Install** with default settings
3. **Start Docker Desktop** and wait for it to be ready
4. **Verify installation** by opening Command Prompt and running:
   ```cmd
   docker --version
   ```

### Step 2: Create Docker Files

Create these files in your project root:

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: erp_local
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: local_password_123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U erp_user -d erp_local"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ERP Application
  app:
    build: .
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://erp_user:local_password_123@db:5432/erp_local
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=local-dev-secret-key-please-change-in-production
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads

volumes:
  postgres_data:
```

**.env.local:**
```env
DATABASE_URL="postgresql://erp_user:local_password_123@localhost:5432/erp_local"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="local-dev-secret-key-please-change-in-production"
NODE_ENV=production
```

### Step 3: Update next.config.js

Add this to your `next.config.js` for Docker compatibility:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your existing config
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  }
}

module.exports = nextConfig
```

### Step 4: Deploy

1. **Open Command Prompt** as Administrator
2. **Navigate to your project folder**:
   ```cmd
   cd C:\path\to\your\erp-project
   ```
3. **Start the application**:
   ```cmd
   docker-compose up -d
   ```
4. **Wait for containers to start** (first time takes 5-10 minutes)
5. **Run database migrations**:
   ```cmd
   docker-compose exec app npx prisma migrate deploy
   ```
6. **Seed the database** (if you have seed data):
   ```cmd
   docker-compose exec app npx prisma db seed
   ```

### Step 5: Access Your Application

- **Open your browser** and go to: `http://localhost:3000`
- **Login** with your application credentials

### Step 6: Create Desktop Shortcut (Optional)

Create a batch file `start-erp.bat`:
```batch
@echo off
cd /d C:\path\to\your\erp-project
docker-compose up -d
echo ERP Application starting...
echo Open http://localhost:3000 in your browser
pause
```

Create another batch file `stop-erp.bat`:
```batch
@echo off
cd /d C:\path\to\your\erp-project
docker-compose down
echo ERP Application stopped.
pause
```

---

## Alternative: Direct Node.js Setup

If you prefer not to use Docker, you can run it directly with Node.js.

### Prerequisites
- Node.js 18+ ([download here](https://nodejs.org/))
- PostgreSQL 14+ ([download here](https://www.postgresql.org/download/windows/))
- Git ([download here](https://git-scm.com/download/win))

### Step 1: Install Dependencies

1. **Install Node.js** (LTS version recommended)
2. **Install PostgreSQL** with default settings
3. **Install Git** for version control

### Step 2: Setup Application

1. **Clone your repository**:
   ```cmd
   git clone <your-repo-url> C:\erp-app
   cd C:\erp-app
   ```

2. **Install packages**:
   ```cmd
   npm install
   ```

3. **Create environment file** (`.env.local`):
   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/erp_local"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="local-dev-secret-key"
   NODE_ENV=development
   ```

4. **Setup database**:
   ```cmd
   # Create database
   createdb -U postgres erp_local
   
   # Run migrations
   npx prisma migrate deploy
   npx prisma generate
   
   # Seed data (if available)
   npx prisma db seed
   ```

5. **Build and start**:
   ```cmd
   npm run build
   npm start
   ```

6. **Access application**: Open `http://localhost:3000`

### Step 3: Auto-Start with Windows (Optional)

Create `start-erp.bat`:
```batch
@echo off
cd /d C:\erp-app
npm start
```

Add this batch file to Windows startup folder:
- Press `Win+R`, type `shell:startup`
- Copy the batch file there

---

## Troubleshooting

### Docker Issues

1. **Docker not starting**:
   - Make sure Hyper-V is enabled
   - Restart Docker Desktop
   - Check Windows version compatibility

2. **Port already in use**:
   ```cmd
   # Stop existing containers
   docker-compose down
   
   # Check what's using port 3000
   netstat -ano | findstr :3000
   ```

3. **Database connection failed**:
   ```cmd
   # Check if database container is running
   docker-compose ps
   
   # View database logs
   docker-compose logs db
   ```

4. **Application won't build**:
   ```cmd
   # Clean and rebuild
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Node.js Issues

1. **PostgreSQL connection error**:
   - Check if PostgreSQL service is running
   - Verify password and database name
   - Check firewall settings

2. **Module not found errors**:
   ```cmd
   # Clear and reinstall
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   ```

3. **Prisma errors**:
   ```cmd
   # Regenerate Prisma client
   npx prisma generate
   ```

### General Tips

- **Run Command Prompt as Administrator** for permissions
- **Check Windows Firewall** if can't access from other devices
- **Use Task Manager** to monitor resource usage
- **Check Event Viewer** for Windows errors

---

## Daily Usage

### Starting the Application
```cmd
# With Docker
cd C:\path\to\erp
docker-compose up -d

# With Node.js
cd C:\erp-app
npm start
```

### Stopping the Application
```cmd
# With Docker
docker-compose down

# With Node.js
# Press Ctrl+C in the terminal
```

### Checking Status
```cmd
# With Docker
docker-compose ps

# With Node.js
# Application runs in terminal window
```

### Viewing Logs
```cmd
# With Docker
docker-compose logs app

# With Node.js
# Logs appear in terminal
```

### Backing Up Data
```cmd
# Database backup
docker-compose exec db pg_dump -U erp_user erp_local > backup.sql

# Or with direct PostgreSQL
pg_dump -U postgres erp_local > backup.sql
```

That's it! Your ERP application will be running locally on the Windows machine, accessible only from your office via RDP.