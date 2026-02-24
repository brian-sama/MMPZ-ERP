# VPS Setup Guide for MMPZ System

This guide walks you through setting up a fresh Virtual Private Server (VPS) to host the MMPZ System.

**Target OS:** Ubuntu 22.04 LTS (Recommended) or 20.04 LTS
**Database:** PostgreSQL (Self-hosted on the same VPS)

---

## 1. Domain Setup (Point Domain to VPS)

Before logging in, configure your domain to point to your new server.

1. **Log in** to your domain registrar (Namecheap, GoDaddy, etc.).
2. **Go to DNS Settings** (often called "Advanced DNS" or "DNS Management").
3. **Create an 'A' Record**:
    * **Type**: `A Record`
    * **Host**: `@` (or leave blank for root domain)
    * **Value/IP**: `Your_VPS_IP_Address` (e.g., `123.45.67.89`)
    * **TTL**: Automatic or 3600
4. *(Optional)* Create a 'CNAME' Record for `www`:
    * **Type**: `CNAME`
    * **Host**: `www`
    * **Value**: `your_domain.com`

*Note: Changes can take up to 24 hours to propagate, but usually happen within minutes.*

---

## 2. Initial Server Setup

Log in to your VPS as `root`:

```bash
ssh root@89.116.26.24
```

### Update the System

```bash
apt update && apt upgrade -y
```

### Create a Non-Root User

```bash
adduser brian
usermod -aG sudo brian
```

*Switch to the user:*

```bash
su - brian
```

---

## 3. Install a GUI (Remote Desktop) - *New!*

This gives you a **Windows-like interface** where you can use a mouse, open windows, and run graphical apps.

### Install XFCE Desktop & XRDP

```bash
sudo apt install -y xfce4 xfce4-goodies
sudo apt install -y xrdp
sudo adduser xrdp ssl-cert
```

### Configure XRDP

```bash
echo "xfce4-session" | tee ~/.xsession
sudo systemctl restart xrdp
```

### Connect from Windows

1. Open **Remote Desktop Connection** on your local Windows PC.
2. Enter your VPS IP.
3. Login with user `brian` and your password.
4. You will see a desktop environment!

---

## 4. Install Desktop Apps (VS Code & Browser) - *New!*

Once you have the GUI (Step 3), you can install apps to work directly on the server.

### Install Firefox (Web Browser)

```bash
sudo apt install -y firefox
```

### Install Visual Studio Code

Run this command in the terminal (or open terminal in your Remote Desktop):

```bash
sudo snap install --classic code
```

*Now you can open VS Code from the Applications menu inside your Remote Desktop!*

---

## 5. Install Server Software

### Install Node.js, PostgreSQL, Nginx, Git, PM2

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# Tools
sudo npm install -g pm2
sudo apt install -y git
```

---

## 6. Database Configuration

### Start PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database & User

```bash
sudo -u postgres psql
```

**SQL Commands:**

```sql
CREATE DATABASE mmpz_db;
CREATE USER brian WITH ENCRYPTED PASSWORD 'Brian7350$@#';
GRANT ALL PRIVILEGES ON DATABASE mmpz_db TO brian;
ALTER DATABASE mmpz_db OWNER TO brian;
\q
```

### Import Full Database Setup

Now that the database is created, import the tables and the initial admin accounts in one go:

```bash
# Navigate to the project directory (Step 7) before running this
sudo -u brian psql -d mmpz_db -f database/full_setup.sql
```

*Note: This file contains the complete schema and seeds the "System Administrator" account.*

---

## 7. Application Deployment

### Git Authentication (SSH Setup)

GitHub no longer supports password authentication for cloning. You must set up an SSH key:

1. **Generate an SSH key** on your VPS:

   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

   *(Press Enter for all prompts to use defaults)*

2. **Copy your Public Key**:

   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

   *Copy the long string of text that starts with `ssh-ed25519`.*

3. **Add to GitHub**:
   * Go to **Settings** > **SSH and GPG keys** on GitHub.
   * Click **New SSH key**.
   * Paste your key and save.

### Clone & Install

```bash
# Clone using SSH instead of HTTPS
git clone git@github.com:brian-sama/mmpz-system.git
cd mmpz-system
npm install
cd client && npm install && npm run build && cd ..
```

### Configure .env

```bash
nano .env
```

Content:

```env
DATABASE_URL=postgresql://brian:Brian7350%24%40%23@localhost:5432/mmpz_db
PORT=3000
```

*Note: Special characters in passwords (like `$`, `@`, `#`) must be URL-encoded (e.g., `@` becomes `%40`) to prevent connection errors.*

### Start App

```bash
pm2 start server.js --name "mmpz-system"
pm2 save
pm2 startup
```

---

## 8. Web Server Setup (Nginx)

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/mmpz
```

Content:

```nginx
server {
    listen 80;
    server_name mmpzmne.co.zw;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/mmpz /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 9. SSL Setup (HTTPS)

Secure your domain with free SSL:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mmpzmne.co.zw
```

Your site is now live at `https://your_domain.com`!
