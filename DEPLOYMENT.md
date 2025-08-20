  echo DATABASE_URL="postgresql://postgres:admin123@localhost:5432/erp_local" > .env.local
  echo NEXTAUTH_URL="https://197.13.3.101" >> .env.local
  echo NEXTAUTH_SECRET="your-secure-random-secret-key-here" >> .env.local
  echo NODE_ENV=production >> .env.local




# ERP Application - Windows Server 2012 R2 Setup

**GUIDE: Deploy ERP app accessible via public IP (https://197.13.3.101/) with office IP restrictions**

This guide shows you how to make your ERP application accessible from your office via the server's public IP address.

## What You Need to Install

1. **Node.js 18+** - Download from: https://nodejs.org/
2. **PostgreSQL 14+** - Download from: https://www.postgresql.org/download/windows/

## Step-by-Step Setup

### Step 1: Get Your Project onto the Server

**Option A: Copy via RDP (Easiest)**
1. **On your local computer**, compress your ERP project folder into a ZIP file
2. **Connect to RDP** and copy the ZIP file through clipboard or drag-and-drop
3. **Extract** the ZIP to `C:\work\ERP` on the server

**Option B: Download from Git Repository**
1. **Install Git** on the server: https://git-scm.com/download/win
2. **Open Command Prompt as Administrator**
3. **Clone your repository**:
   ```cmd
   cd C:\work
   git clone https://github.com/your-username/your-repo-name.git ERP
   ```

**Option C: Use a USB Drive**
1. **Copy your project** to a USB drive from your local computer
2. **Plug USB into the server** and copy to `C:\work\ERP`

### Step 2: Install Software

1. **Download and install Node.js 18** (choose Windows Installer)
2. **Download and install PostgreSQL** with these settings:
   - Password: `admin123` (remember this!)
   - Port: `5432` (default)
   - Leave everything else as default

### Step 3: Setup Your Application

1. **Open Command Prompt as Administrator**

2. **Go to your app folder**:
   ```cmd
   cd C:\work\ERP
   ```

3. **Install the app packages**:
   ```cmd
   npm install
   ```

4. **Create a file called `.env.local`** in your C:\work\ERP folder with this content:
   ```env
   DATABASE_URL="postgresql://postgres:admin123@localhost:5432/erp_local"
   NEXTAUTH_URL="https://197.13.3.101"
   NEXTAUTH_SECRET="your-secure-random-secret-key-here"
   NODE_ENV=production
   ```

### Step 4: Create the Database

1. **Open a new Command Prompt as Administrator**

2. **Create the database**:
   ```cmd
   createdb -U postgres erp_local
   ```
   (It will ask for password - enter: `admin123`)

3. **Setup the database tables**:
   ```cmd
   cd C:\work\ERP
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Add sample data** (if you want):
   ```cmd
   npx prisma db seed
   ```

### Step 5: Build and Start Your App

1. **Build the app** (optimized for 4GB RAM):
   ```cmd
   set NODE_OPTIONS=--max_old_space_size=2048
   npm run build
   ```

2. **Start the app**:
   ```cmd
   npm start
   ```

3. **Start the app on all network interfaces**:
   ```cmd
   npm start -- --hostname 0.0.0.0
   ```

### Step 6: Configure Windows Security & Access

1. **Open Windows Firewall with Advanced Security** (search for "wf.msc")

2. **Create Inbound Rule for Port 3000**:
   - Right-click "Inbound Rules" → "New Rule"
   - Rule Type: Port
   - Protocol: TCP, Specific Local Ports: 3000
   - Action: Allow the connection
   - Profile: Check all three (Domain, Private, Public)
   - Name: "ERP Application Port 3000"

3. **Restrict Access to Your Office IP** (IMPORTANT for security):
   - In the new rule, right-click → Properties
   - Go to "Scope" tab
   - Under "Remote IP address", select "These IP addresses"
   - Click "Add" and enter your office's static IP address
   - Click OK

4. **Configure the app to listen on all interfaces**:
   Update your `START-ERP.bat` file to:
   ```batch
   @echo off
   title ERP Application
   cd /d C:\work\ERP
   set NODE_OPTIONS=--max_old_space_size=2048
   echo Starting ERP Application...
   npm start -- --hostname 0.0.0.0
   pause
   ```

### Step 7: Setup HTTPS (Recommended)

1. **Install a reverse proxy like Nginx** or use IIS
2. **Get an SSL certificate** (Let's Encrypt or commercial)
3. **Configure HTTPS redirect**

**Quick HTTPS with IIS** (if available):
- Install IIS role
- Create site pointing to your app on port 3000
- Add SSL certificate
- Configure URL rewrite to proxy to localhost:3000

### Step 8: Test Access

1. **From your office**, open browser to: `https://197.13.3.101:3000`
2. **If using HTTPS proxy**: `https://197.13.3.101`

## Easy Start/Stop (Create These Files)

**Create `START-ERP.bat`** on your Desktop:
```batch
@echo off
title ERP Application
cd /d C:\work\ERP
set NODE_OPTIONS=--max_old_space_size=2048
echo Starting ERP Application...
echo Application will be accessible at https://197.13.3.101:3000
npm start -- --hostname 0.0.0.0
pause
```

**Create `STOP-ERP.bat`** on your Desktop:
```batch
@echo off
title Stop ERP
echo Stopping ERP Application...
taskkill /f /im node.exe
echo ERP Application stopped.
pause
```

## Daily Usage

- **Start**: Double-click `START-ERP.bat`
- **Stop**: Double-click `STOP-ERP.bat` or close the command window
- **Access from office**: Open browser to `https://197.13.3.101:3000`
- **Local access**: `http://localhost:3000`

## Security Notes

⚠️ **IMPORTANT**: The Windows Firewall rule restricts access to your office IP only. Without this restriction, your ERP would be accessible to anyone on the internet.

**Your office static IP**: Make sure to replace "your office's static IP address" in Step 6 with your actual office IP address.

## If Something Goes Wrong

**Problem: Can't connect to database**
- Open Services (services.msc) and make sure "postgresql" service is running
- Try restarting PostgreSQL service

**Problem: App won't build (out of memory)**
```cmd
# Use these commands instead:
set NODE_OPTIONS=--max_old_space_size=3072
npm run build
```

**Problem: App crashes**
```cmd
# Clear everything and reinstall:
rmdir /s /q node_modules
del package-lock.json
npm install
npx prisma generate
npm run build
npm start
```

**Problem: Can't access from office (https://197.13.3.101:3000)**
- Check Windows Firewall rule is created and enabled
- Verify your office IP is correctly added to the firewall rule
- Test local access first: `http://localhost:3000`
- Check if port 3000 is being used:
  ```cmd
  netstat -ano | findstr :3000
  ```

**Problem: "This site can't be reached" error**
- Verify the server's public IP (197.13.3.101) is correct
- Check if your ISP/router forwards port 3000 to the server
- Try accessing without HTTPS first: `http://197.13.3.101:3000`

**Problem: PostgreSQL asks for password**
- Use the password you set during installation (`admin123` if you followed this guide)

## Memory Optimization for 4GB RAM

The batch files include `NODE_OPTIONS=--max_old_space_size=2048` which limits Node.js to use 2GB RAM, leaving 2GB for PostgreSQL and Windows.

## Backup Your Data (Optional)

To backup your database:
```cmd
pg_dump -U postgres erp_local > C:\erp_backup.sql
```

## Additional Network Configuration

If you can't access from your office, you may need to:

1. **Configure your router/firewall** to forward port 3000 to the Windows Server
2. **Check if the server is behind a NAT** - you might need port forwarding
3. **Verify the public IP** - use `whatismyip.com` from the server to confirm the public IP

---

**That's it! Your ERP app will be accessible at https://197.13.3.101:3000 from your office only.**