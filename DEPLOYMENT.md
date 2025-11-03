# Deployment Guide

This guide covers deploying the Chat App to various platforms.

## Prerequisites

- Node.js 14+ installed
- MongoDB instance (local or cloud)
- Google OAuth credentials
- Domain name (for production)
- SSL certificate (for production)

## Environment Variables

Make sure to set these environment variables in production:

```bash
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_client_secret
CALLBACK_URL=https://yourdomain.com/api/auth/callback/google
JWT_SECRET=your_strong_jwt_secret
MONGODB_URI=your_production_mongodb_uri
PORT=3000
NODE_ENV=production
```

## Local Development

1. Clone the repository
<<<<<<< HEAD
2. Create a `.env` file in the project root with the following minimum variables (for local dev):

```
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=dev-jwt-secret
SESSION_SECRET=dev-session-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

3. Install dependencies:

```powershell
npm install
```

4. Start MongoDB (if running locally). Example for Windows with MongoDB installed as a service:

```powershell
# Start MongoDB service
net start MongoDB
```

5. Start the app in development mode:

```powershell
npm run dev
```

6. Open the web client in your browser at http://localhost:3000 and use the Google login flow. For local testing of Google OAuth, ensure the OAuth redirect URI configured in Google Console matches the `CALLBACK_URL` above.

Testing the new features

- Update Profile: Open Settings (Ctrl/Cmd + ,), pick an avatar, edit name/status, click "Save Changes". The client will upload avatar and update profile via `PUT /api/users/profile`.
- Group Chat: Click the "+" (New Chat) button. When prompted type `create` to create a new group, provide a group name, and the group will be created and opened. Type `list` to see groups you participate in.
=======
2. Run `./setup.sh` to set up the project
3. Update `.env` with your credentials
4. Run `npm start` to start the server
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259

## Production Deployment

### Option 1: Traditional VPS/Server

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install MongoDB
   wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   sudo apt update
   sudo apt install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   
   # Install PM2 globally
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install -y nginx
   ```

2. **Deploy Application**
   ```bash
   # Clone your repository
   git clone <your-repo-url>
   cd chat-app
   
   # Install dependencies
   npm install --production
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your production values
   
   # Start with PM2
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx**
   ```nginx
   # /etc/nginx/sites-available/chat-app
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/chat-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Option 2: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm ci --only=production
   
   COPY . .
   
   EXPOSE 3000
   
   USER node
   
   CMD ["node", "server.js"]
   ```

2. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - MONGODB_URI=mongodb://mongo:27017/chatapp
       depends_on:
         - mongo
       restart: unless-stopped
   
     mongo:
       image: mongo:7.0
       volumes:
         - mongo_data:/data/db
       restart: unless-stopped
   
   volumes:
     mongo_data:
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

### Option 3: Cloud Platforms

#### Heroku

1. **Prepare for Heroku**
   ```bash
   # Install Heroku CLI
   npm install -g heroku
   
   # Login and create app
   heroku login
   heroku create your-chat-app
   
   # Add MongoDB addon
   heroku addons:create mongolab:sandbox
   
   # Set environment variables
   heroku config:set GOOGLE_CLIENT_ID=your_client_id
   heroku config:set GOOGLE_CLIENT_SECRET=your_client_secret
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set CALLBACK_URL=https://your-chat-app.herokuapp.com/api/auth/callback/google
   
   # Deploy
   git push heroku main
   ```

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy automatically

#### AWS/Azure/GCP

Follow their respective Node.js deployment guides and set up:
- Application hosting (EC2, App Service, Compute Engine)
- Database (MongoDB Atlas or managed MongoDB)
- Load balancer and SSL

## Database Setup

### MongoDB Atlas (Recommended for production)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Create database user
4. Whitelist IP addresses
5. Get connection string and update `MONGODB_URI`

### Self-hosted MongoDB

1. Install MongoDB on your server
2. Configure authentication
3. Set up backups
4. Monitor performance

## Security Checklist

- [ ] Use strong JWT secret
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Use environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Use secure headers
- [ ] Set up monitoring and logging
- [ ] Regular security updates

## Monitoring and Maintenance

### PM2 Monitoring
```bash
pm2 monit
pm2 logs
pm2 restart chat-app
```

### Database Backups
```bash
# MongoDB backup
mongodump --uri="mongodb://localhost:27017/chatapp" --out=/backup/$(date +%Y%m%d)
```

### Log Rotation
```bash
# Set up logrotate for application logs
sudo nano /etc/logrotate.d/chat-app
```

### Health Checks
Set up monitoring with tools like:
- Uptime Robot
- New Relic
- DataDog
- Custom health check endpoints

## Scaling

### Horizontal Scaling
- Use load balancer (nginx, HAProxy)
- Multiple app instances with PM2 cluster mode
- Session store (Redis)
- Database clustering

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Use caching (Redis)
- CDN for static assets

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB service status
   - Verify connection string
   - Check network connectivity

2. **Google OAuth Not Working**
   - Verify OAuth credentials
   - Check redirect URIs
   - Ensure HTTPS in production

3. **Socket.io Connection Issues**
   - Check firewall settings
   - Verify WebSocket support
   - Check proxy configuration

4. **File Upload Issues**
   - Check disk space
   - Verify upload directory permissions
   - Check file size limits

### Logs
```bash
# Application logs
pm2 logs chat-app

# System logs
sudo journalctl -u mongod
sudo tail -f /var/log/nginx/error.log
```

## Performance Optimization

1. **Database Optimization**
   - Add indexes for frequently queried fields
   - Use aggregation pipelines
   - Implement pagination

2. **Application Optimization**
   - Enable gzip compression
   - Use CDN for static assets
   - Implement caching
   - Optimize images

3. **Server Optimization**
   - Use SSD storage
   - Adequate RAM and CPU
   - Configure swap if needed

## Backup Strategy

1. **Database Backups**
   - Daily automated backups
   - Test restore procedures
   - Store backups off-site

2. **Application Backups**
   - Code repository (Git)
   - Configuration files
   - Uploaded files

3. **Recovery Plan**
   - Document recovery procedures
   - Test disaster recovery
   - Have rollback plan

## Support

For deployment issues:
1. Check the logs first
2. Review this guide
3. Check the main README.md
4. Create an issue in the repository

