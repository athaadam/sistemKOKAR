# JWT Authentication Setup Guide

## Overview

SIKOKAR menggunakan JWT (JSON Web Token) untuk authentication. Sistem ini menggantikan session-based authentication dengan token stateless yang expire setelah **1 hari (24 jam)**.

**Key Features:**
- ✅ Stateless authentication (tidak perlu session storage)
- ✅ Token automatically expire after 24 hours
- ✅ User must login again after token expiry
- ✅ Secure Bearer token in Authorization header
- ✅ Automatic redirect to login on 401 (unauthorized)

---

## Architecture

### Request Flow

```
1. User Login
   └─ POST /api/auth/login (username, password)
      └─ Backend validates credentials
      └─ Backend generates JWT token (valid 24h)
      └─ Frontend receives token + user info
      └─ Frontend saves token to localStorage

2. Accessing Protected Routes
   └─ Frontend requests /api/protected-endpoint
      └─ Frontend adds "Authorization: Bearer <token>" header
      └─ Backend middleware extracts & validates token
      └─ If valid: populate req.user and proceed
      └─ If invalid/expired: return 401 Unauthorized

3. Frontend handles 401
   └─ Clear token from localStorage
   └─ Redirect to /login page
   └─ User must login again

4. Logout
   └─ Frontend calls POST /api/auth/logout
   └─ Frontend clears token from localStorage
   └─ Frontend redirects to /login
```

---

## Installation & Setup

### 1. Backend Setup

#### Step 1: Install Dependencies
```bash
cd be-sikokar
npm install jsonwebtoken
```

#### Step 2: Configure Environment Variables

Edit `.env` file and add/update:
```env
# JWT Configuration
JWT_SECRET=sikokar-jwt-secret-2025-ganti-dengan-string-random-panjang

# Backend Port
PORT=3001

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

**⚠️ IMPORTANT:** Change `JWT_SECRET` to a strong random string in production!

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 3: Verify Files Are Updated

Check that these files exist and are properly configured:

```bash
# Verify JWT utility exists
ls -la be-sikokar/src/utils/jwt.js

# Verify auth middleware uses JWT
grep "Bearer" be-sikokar/src/middleware/auth.js

# Verify express-session is removed
grep -c "express-session" be-sikokar/src/app.js  # Should return 0
```

#### Step 4: Start Backend Server
```bash
cd be-sikokar
npm start
```

Expected output:
```
  SIKOKAR API v1.5 — http://localhost:3001/api
```

---

### 2. Frontend Setup

#### Step 1: Verify Files Exist

Check that these files were created/updated:

```bash
# Token management utility
ls -la fe-sikokar/src/lib/auth.ts

# API client with JWT support
grep "Authorization: Bearer" fe-sikokar/src/lib/api.ts
```

#### Step 2: Start Frontend
```bash
cd fe-sikokar
npm run dev
```

Frontend should be available at: `http://localhost:3000`

---

## Testing the JWT Auth System

### Test 1: Backend Auth Endpoints

#### 1a. Test without token (should fail)
```bash
curl http://localhost:3001/api/auth/me
# Expected response:
# {"success":false,"message":"Login required"}
```

#### 1b. Generate test token
```bash
node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'sikokar-jwt-secret-2025-ganti-dengan-string-random-panjang';
const token = jwt.sign({
  id: 'test-id',
  username: 'testuser',
  name: 'Test User',
  role: 'admin'
}, SECRET, { expiresIn: '1d' });
console.log(token);
"
```

#### 1c. Test with valid token
```bash
TOKEN="<your-generated-token>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/auth/me
# Expected response:
# {"success":true,"message":"OK","user":{...},"ROLE_LABELS":{...}}
```

#### 1d. Test with invalid token
```bash
curl -H "Authorization: Bearer invalid.token.here" http://localhost:3001/api/auth/me
# Expected response:
# {"success":false,"message":"Login required"}
```

### Test 2: Frontend Login Flow

1. **Open browser:** `http://localhost:3000/login`
2. **Enter credentials:** Use a valid user from database
3. **Check localStorage:** 
   - Open DevTools (F12)
   - Go to Application → Storage → Local Storage
   - Look for `sikokar_token` key
   - Should contain a valid JWT token

4. **Navigate to protected page:** `/dashboard`
   - Should load successfully
   - Token is automatically sent in Authorization header

### Test 3: Token Expiry (Optional)

To test token expiration quickly:

```javascript
// In browser DevTools console
localStorage.removeItem('sikokar_token');
// Try to access protected page
// Should redirect to /login
```

---

## File Changes Summary

### Backend Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/utils/jwt.js` | **NEW** | JWT signing & verification |
| `src/middleware/auth.js` | **MODIFIED** | Bearer token extraction & validation |
| `src/controllers/authController.js` | **MODIFIED** | Return JWT on login, stateless logout |
| `src/app.js` | **MODIFIED** | Removed express-session middleware |
| `src/controllers/*.js` (14 files) | **MODIFIED** | `req.session.user` → `req.user` |
| `.env` | **MODIFIED** | Added JWT_SECRET |
| `package.json` | **MODIFIED** | Added jsonwebtoken dependency |

### Frontend Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/auth.ts` | **NEW** | Token storage management |
| `src/lib/api.ts` | **MODIFIED** | Bearer header + 401 handling |
| `src/components/layout/Sidebar.tsx` | **NO CHANGE** | Already calls logout() correctly |
| `src/app/(app)/layout.tsx` | **NO CHANGE** | Already handles 401 via getMe() |

---

## JWT Token Structure

### Token Payload
```json
{
  "id": "user-uuid",
  "username": "username",
  "name": "Full Name",
  "role": "admin",
  "custom_menus": "menu1,menu2",
  "lokasi_id": "location-uuid",
  "iat": 1779304955,
  "exp": 1779391355
}
```

### Token Expiry
- **Default:** 1 day (24 hours)
- **Configured in:** `be-sikokar/src/utils/jwt.js` (line 6)
- **Change expiry:** Edit `EXPIRES_IN = '1d'` to desired value
  - `'24h'` = 24 hours
  - `'7d'` = 7 days
  - `'30m'` = 30 minutes (for testing)

---

## Handling Token Expiry

### On Backend
- Invalid/expired tokens return **401 Unauthorized**
- Middleware automatically rejects before handler is called

### On Frontend
- Any **401 response** triggers:
  1. Token cleared from localStorage
  2. Automatic redirect to `/login`
  3. User sees login page

### Example Response
```json
{
  "success": false,
  "message": "Session expired"
}
```

---

## Common Issues & Troubleshooting

### Issue 1: "Login required" even with valid token

**Cause:** Different JWT_SECRET between token generation and verification

**Solution:**
```bash
# Check backend .env file
cat be-sikokar/.env | grep JWT_SECRET

# Make sure you're using the SAME secret when:
# 1. Generating test token
# 2. Starting backend server
```

### Issue 2: Token not sent in requests

**Check:**
1. Is token saved in localStorage?
   - Open DevTools → Application → Local Storage → `sikokar_token`
2. Are headers correct?
   - Should be: `Authorization: Bearer <token>`

**Debug in Frontend:**
```javascript
// In browser console
localStorage.getItem('sikokar_token')  // Should show token
```

### Issue 3: Always redirect to login

**Cause:** Token might be expired or corrupted

**Solution:**
```javascript
// In browser console
localStorage.removeItem('sikokar_token');
// Reload page and login again
```

### Issue 4: Port already in use

**For Port 3001 (Backend):**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3002 npm start
```

**For Port 3000 (Frontend):**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

---

## Security Best Practices

### 🔐 Production Checklist

- [ ] **Change JWT_SECRET** to a strong random value
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Use HTTPS** in production
  - Set `HTTPS_ONLY=true` in backend `.env`
  - Update `CORS_ORIGIN` to production URL

- [ ] **Set secure cookie flags**
  - HttpOnly: Prevents JavaScript access (already set)
  - Secure: Only sent over HTTPS (auto-enabled with HTTPS_ONLY)
  - SameSite: Prevents CSRF attacks (already set to 'lax')

- [ ] **Rotate JWT_SECRET regularly**
  - Don't reuse across environments
  - Each environment should have unique secret

- [ ] **Monitor token usage**
  - Log authentication attempts
  - Alert on suspicious patterns

- [ ] **Enable rate limiting**
  - Already implemented: 5 login attempts per 5 minutes per IP
  - Check `src/controllers/authController.js` for configuration

### ⚠️ What NOT to Do

- ❌ Store JWT in localStorage and access from JavaScript (XSS vulnerability)
  - **We accept this trade-off for simplicity**
  - In production, consider using HttpOnly cookie with refresh token pattern

- ❌ Send JWT in URL parameters
  - Always use Authorization header or HttpOnly cookie

- ❌ Log or expose JWT secrets
  - Never commit .env files to version control

- ❌ Disable HTTPS in production
  - Always use HTTPS for token transmission

---

## Configuration Reference

### Backend (`be-sikokar/.env`)

```env
# === JWT Configuration ===
JWT_SECRET=your-secret-key-here-change-this-in-production

# === Server Configuration ===
NODE_ENV=development
PORT=3001
HTTPS_ONLY=false

# === Database ===
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=sikokar

# === CORS ===
CORS_ORIGIN=http://localhost:3000

# === Directories ===
UPLOAD_DIR=uploads
BACKUP_DIR=backup
```

### Frontend Environment Variables

No additional configuration needed. The frontend automatically:
- Detects backend URL from `NEXT_PUBLIC_API_URL` or defaults to `/api`
- Stores token in localStorage key: `sikokar_token`
- Sends token in `Authorization: Bearer <token>` header

---

## API Endpoints

### Authentication Endpoints

#### GET `/api/auth/login`
Check if user is logged in (always returns `{"user": null}` now)

#### POST `/api/auth/login`
Login with credentials
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Selamat datang, User!",
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "username": "user",
    "name": "Full Name",
    "role": "admin"
  }
}
```

#### POST `/api/auth/logout`
Logout (client-side token clearing is sufficient)
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

#### GET `/api/auth/me`
Get current user info (requires token)
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "message": "OK",
  "user": {...},
  "ROLE_LABELS": {...},
  "canAccess": "function"
}
```

---

## Monitoring & Logging

### Backend Logs

Monitor authentication events:
```bash
# View real-time logs
tail -f /path/to/backend.log | grep -i "auth\|login"

# Check failed login attempts
grep "Username atau password salah" /path/to/backend.log
```

### Frontend Logs

Check for auth-related errors:
```javascript
// In browser console
// Check API client debug logs
console.log(localStorage.getItem('sikokar_token'));

// Check for 401 errors
// Open DevTools → Network → Filter by "auth"
```

---

## Migration from Old Session Auth

This setup **completely replaces** the old express-session based authentication:

**Removed:**
- ❌ `express-session` middleware
- ❌ `connect-session-knex` session store
- ❌ Sessions table in database (can be dropped)
- ❌ Session cookies (connect.sid)

**Added:**
- ✅ JWT tokens
- ✅ Bearer token authentication
- ✅ localStorage for token storage
- ✅ 24-hour token expiry

**User Impact:**
- Session timeout is now fixed at 24 hours
- Users see "Login required" instead of "Session expired"
- No session persistence across browser restart (expected behavior)

---

## Updating Token Expiry Time

To change how long tokens remain valid:

1. **Edit:** `be-sikokar/src/utils/jwt.js`
2. **Change line 6:**
   ```javascript
   const EXPIRES_IN = '1d';  // Change this value
   ```

**Common values:**
- `'1h'` = 1 hour
- `'12h'` = 12 hours
- `'1d'` = 1 day (default)
- `'7d'` = 7 days
- `'30d'` = 30 days

3. **Restart backend** for changes to take effect

---

## Testing Checklist

After setup, verify everything works:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can login with valid credentials
- [ ] Token appears in localStorage after login
- [ ] Can access protected pages
- [ ] Can logout successfully
- [ ] Cannot access protected pages without token
- [ ] Invalid token returns 401
- [ ] Expired token redirects to login

---

## Support & Debugging

### Enable Debug Logging

**Backend:**
Add debug statements in auth middleware:
```javascript
function extractUser(req) {
  const header = req.headers.authorization || '';
  console.log('[JWT] Authorization header:', header.substring(0, 20) + '...');
  // ... rest of function
}
```

**Frontend:**
Check in browser console:
```javascript
console.log('Token:', localStorage.getItem('sikokar_token'));
console.log('Auth header:', `Bearer ${localStorage.getItem('sikokar_token')}`);
```

### Database Queries

Check user authentication status:
```sql
-- View users
SELECT id, username, name, role, aktif FROM users;

-- Check last login
SELECT id, username, last_login, last_login_ip FROM users;

-- Check failed login attempts
SELECT id, username, failed_attempts FROM users WHERE failed_attempts > 0;
```

---

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test all functionality
3. ✅ Update production JWT_SECRET
4. ✅ Enable HTTPS in production
5. ✅ Set up monitoring/logging
6. ✅ Document any custom changes

---

**Created:** 2025-05-21  
**Version:** 1.0.0  
**System:** SIKOKAR v1.5+
