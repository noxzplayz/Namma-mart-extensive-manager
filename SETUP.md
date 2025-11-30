# Namma Mart Panel - Setup and Update Guide

## Initial Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)
- Git
- A web browser

### Installation Steps

1. **Clone or Download the Repository**
   ```bash
   git clone https://github.com/noxzplayz/Namma-mart-extensive-manager.git
   cd Namma-mart-extensive-manager
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Make Update Script Executable**
   ```bash
   chmod +x update.sh
   ```

4. **Start the Server**
   ```bash
   node server.js
   ```

5. **Access the Application**
   - Open your web browser
   - Navigate to `http://localhost:3000`
   - Default admin credentials: `nammamart` / `admin12nammamart`

## Update System Setup

The application includes an automatic update system that can pull updates from Git and restart the server automatically.

### For Existing Git Repository

If your project is already a Git repository with a remote origin:

1. **Ensure Remote Origin is Set**
   ```bash
   git remote -v
   ```
   If no remote is set, add one:
   ```bash
   git remote add origin https://github.com/yourusername/your-repo-name.git
   ```

2. **Make Update Script Executable**
   ```bash
   chmod +x update.sh
   ```

3. **Test Update Process**
   ```bash
   ./update.sh
   ```

### For New Git Repository Setup

If setting up updates for the first time:

1. **Initialize Git Repository**
   ```bash
   git init
   ```

2. **Add Remote Origin**
   ```bash
   git remote add origin https://github.com/yourusername/your-repo-name.git
   ```

3. **Pull Initial Code**
   ```bash
   git pull origin main
   ```
   (Use `master` if your default branch is `master`)

4. **Make Update Script Executable**
   ```bash
   chmod +x update.sh
   ```

5. **Test Update Process**
   ```bash
   ./update.sh
   ```

## How the Update System Works

### Automatic Updates via Admin Panel

1. **Check for Updates**: The admin panel automatically checks for updates every 5 minutes
2. **Visual Indicator**: When updates are available, the update button shows an animated RGB border and pulsing effect
3. **Update Details**: Clicking the update button shows a modal with details of what's new in the update
4. **Proceed with Update**: Click "Proceed with Update" to download and install updates automatically

### What Happens During Update

1. **Fetch Changes**: Downloads latest changes from the Git repository
2. **Install Dependencies**: Runs `npm install` if `package.json` exists
3. **Restart Server**: Automatically stops the current server and starts it again
4. **Log Output**: Server output is logged to `server.log`

### Manual Update

You can also run updates manually from the command line:
```bash
./update.sh
```

### Update Process Details

- **Safe Updates**: The script checks if updates are actually available before proceeding
- **Dependency Management**: Automatically installs new dependencies
- **Server Restart**: Ensures the application runs with the latest code
- **Error Handling**: Provides clear error messages if something goes wrong
- **Logging**: All server output is saved to `server.log`

## Troubleshooting

### Update Fails
- Check internet connection
- Verify Git repository URL is correct
- Ensure you have push/pull permissions to the repository
- Check `server.log` for error details

### Server Won't Start After Update
- Check `server.log` for error messages
- Ensure all dependencies are installed: `npm install`
- Verify Node.js version compatibility

### Permission Issues
- Make sure `update.sh` is executable: `chmod +x update.sh`
- Run the update script with appropriate permissions

## Security Notes

- The update system only pulls from the configured Git remote
- No external scripts or executables are downloaded
- All updates go through your Git repository's version control
- Admin authentication is required for updates

## Support

For issues with setup or updates, check:
1. `server.log` for server errors
2. Git status: `git status`
3. Network connectivity
4. Repository permissions

---

**Note**: Always backup your `db.json` file before major updates, as it contains all your application data.
