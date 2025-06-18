# MAC Scanner - Network Security Monitor

A comprehensive network security monitoring application that scans switches via SSH to detect MAC addresses and identify unauthorized devices on your network.

## Features

### 🔍 **Network Scanning**
- SSH-based MAC address scanning from network switches
- Support for multiple switch vendors and configurations
- VLAN-specific scanning capabilities
- Real-time device discovery and status monitoring

### 📊 **Job Management**
- Create and manage scanning jobs with unique configurations
- Flexible scheduling (manual or interval-based)
- Multiple switches per job with individual credentials
- Configurable retention policies for discovered devices

### 🛡️ **Security Monitoring**
- Device authorization and whitelist management
- Unauthorized device detection and alerting
- Real-time notifications for security events
- Comprehensive device status tracking (online/offline)

### 📱 **Modern Web Interface**
- Cyberpunk-themed dark UI with neon accents
- Responsive design for desktop and mobile
- Real-time updates via WebSocket connections
- Intuitive dashboard with key metrics and activity

### 🔔 **Notification System**
- Real-time alerts for new and unauthorized devices
- Configurable notification preferences per job
- WebSocket-based instant notifications
- Notification history and management

## Quick Start

### Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Linux/Unix environment** (tested on Ubuntu, CentOS, Debian)
- **Network access** to target switches via SSH

### Installation & Startup

1. **Clone or extract the application files**
2. **Make the startup script executable:**
   ```bash
   chmod +x start.sh
   ```

3. **Run the application:**
   ```bash
   ./start.sh
   ```

The startup script will:
- Install all required dependencies
- Create necessary directories
- Start both backend and frontend services
- Display access URLs for your network

### Access the Application

After startup, access the web interface at:
- **Local access:** `http://localhost:3000`
- **Network access:** `http://YOUR_IP:3000`

The startup script will display the exact URLs for your environment.

## Configuration

### Creating Your First Job

1. **Navigate to Jobs** → **Create Job**
2. **Configure basic settings:**
   - Job name (e.g., "Main Office Scan")
   - VLAN ID to scan
   - Schedule type (Manual or Interval)

3. **Add switches:**
   - Switch name and IP address
   - SSH credentials (username/password)
   - Test connection before saving

4. **Set retention policy:**
   - **7 Days:** Remove offline devices after 7 days
   - **Keep Forever:** Never remove devices
   - **Remove Immediately:** Remove devices when they go offline

5. **Configure notifications:**
   - Enable/disable new device notifications
   - Enable/disable unauthorized device warnings

### Switch Compatibility

The application supports switches that provide MAC address tables via SSH commands:
- **Cisco switches:** `show mac address-table vlan X`
- **HP/Aruba switches:** `show mac-address-table vlan X`
- **Generic switches:** Various command formats automatically detected

### SSH Requirements

Ensure your switches have:
- SSH enabled and accessible
- User account with appropriate privileges
- MAC address table read permissions

## Architecture

### Backend Services
- **Express.js API server** (Port 3001)
- **SQLite database** for data persistence
- **SSH2 library** for switch communication
- **WebSocket server** for real-time updates
- **Cron-based job scheduler**

### Frontend Application
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication
- **WebSocket client** for real-time updates

### Database Schema
- **Jobs:** Scanning job configurations
- **Switches:** Switch connection details per job
- **Known Devices:** Discovered MAC addresses and metadata
- **Job History:** Execution logs and statistics
- **Notifications:** Alert messages and status
- **Whitelist:** Authorized device registry

## API Endpoints

### Jobs Management
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/jobs/:id/execute` - Execute job manually

### Device Management
- `GET /api/jobs/:id/devices` - List job devices
- `PUT /api/devices/:id/authorize` - Authorize/unauthorize device
- `DELETE /api/devices/:id` - Delete device
- `GET /api/jobs/:id/whitelist` - Get whitelist
- `POST /api/jobs/:id/whitelist` - Add to whitelist

### Monitoring
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/notifications` - List notifications
- `PUT /api/notifications/:id/read` - Mark as read

## Troubleshooting

### Common Issues

#### 1. **SSH Connection Failures**
```
Error: Connection timeout or authentication failed
```
**Solutions:**
- Verify switch IP address and SSH port (default: 22)
- Check username/password credentials
- Ensure SSH is enabled on the switch
- Test manual SSH connection: `ssh username@switch-ip`
- Check firewall rules between server and switches

#### 2. **No MAC Addresses Found**
```
Warning: 0 devices found during scan
```
**Solutions:**
- Verify VLAN ID exists on the switch
- Check if devices are actually connected to the VLAN
- Try different MAC table commands manually
- Ensure user has sufficient privileges to view MAC tables

#### 3. **Database Errors**
```
Error: SQLITE_BUSY: database is locked
```
**Solutions:**
- Stop the application and restart
- Check file permissions on `./data/` directory
- Ensure no other processes are accessing the database
- Delete `./data/mac_scanner.db` to reset (loses all data)

#### 4. **Port Already in Use**
```
Error: listen EADDRINUSE :::3001
```
**Solutions:**
- Stop other services using ports 3000/3001
- Kill existing processes: `pkill -f "node backend/server.js"`
- Change ports in `start.sh` if needed

#### 5. **Frontend Build Failures**
```
Error: Failed to build frontend
```
**Solutions:**
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node -v` (requires 18+)

### Log Files

Check these log files for detailed error information:
- **Backend logs:** `./logs/backend.log`
- **Frontend logs:** `./logs/frontend.log`

### Debug Mode

For detailed debugging, start services manually:

1. **Backend with debug:**
   ```bash
   DEBUG=* node backend/server.js
   ```

2. **Frontend development mode:**
   ```bash
   npm run dev
   ```

### Network Connectivity

Test network connectivity to switches:
```bash
# Test SSH connectivity
ssh -o ConnectTimeout=10 username@switch-ip

# Test from application server
telnet switch-ip 22
```

### Performance Optimization

For large networks:
- Increase SSH timeouts in `backend/services/sshService.js`
- Adjust job intervals to reduce switch load
- Use retention policies to limit database size
- Monitor system resources during scans

## Security Considerations

### Switch Credentials
- Use dedicated service accounts with minimal privileges
- Store credentials securely (consider environment variables)
- Regularly rotate SSH passwords
- Use SSH keys where possible

### Network Security
- Run on isolated management network
- Use firewall rules to restrict access
- Enable HTTPS in production (reverse proxy recommended)
- Regular security updates

### Data Protection
- Database contains network topology information
- Implement backup procedures for SQLite database
- Consider encryption for sensitive deployments

## Development

### Project Structure
```
├── backend/
│   ├── database/          # Database schema and connection
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   └── server.js         # Main server file
├── src/
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── services/        # API client services
│   └── contexts/        # React contexts
├── data/                # SQLite database storage
├── logs/                # Application logs
└── start.sh            # Startup script
```

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Submit pull request with detailed description

### Building from Source

```bash
# Install dependencies
npm install

# Development mode
npm run dev          # Frontend
npm run backend      # Backend

# Production build
npm run build
npm run preview
```

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues and questions:
1. Check this README for common solutions
2. Review log files for error details
3. Test individual components (SSH, database, network)
4. Create detailed issue reports with logs and configuration

---

**MAC Scanner** - Professional network security monitoring made simple.