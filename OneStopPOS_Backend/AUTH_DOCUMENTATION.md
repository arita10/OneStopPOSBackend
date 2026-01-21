# Authentication System Documentation

## Overview

The OneStopPOS backend now includes a complete authentication system with:
- User login with JWT tokens
- Role-based access control (Admin/User)
- Password hashing with bcrypt
- Protected routes

## Default Admin Account

```
Username: admin
Password: admin123
```

**⚠️ IMPORTANT:** Change the admin password after first login!

---

## Authentication Endpoints

### 1. Login
**POST** `/api/auth/login`

Login and receive JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@onestoppos.com",
    "full_name": "System Administrator",
    "role": "admin",
    "last_login": "2026-01-19T..."
  }
}
```

---

### 2. Get Current User
**GET** `/api/auth/me`

Get currently logged-in user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@onestoppos.com",
    "full_name": "System Administrator",
    "role": "admin"
  }
}
```

---

### 3. Register New User (Admin Only)
**POST** `/api/auth/register`

Create a new user account. Only admins can create users.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "username": "cashier1",
  "email": "cashier1@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "user"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 2,
    "username": "cashier1",
    "email": "cashier1@example.com",
    "full_name": "John Doe",
    "role": "user",
    "is_active": true,
    "created_at": "2026-01-19T..."
  }
}
```

---

### 4. Get All Users (Admin Only)
**GET** `/api/auth/users`

Get list of all users.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@onestoppos.com",
    "full_name": "System Administrator",
    "role": "admin",
    "is_active": true,
    "last_login": "2026-01-19T...",
    "created_at": "2026-01-19T..."
  }
]
```

---

### 5. Get User by ID (Admin Only)
**GET** `/api/auth/users/:id`

Get specific user by ID.

**Headers:**
```
Authorization: Bearer <admin-token>
```

---

### 6. Update User (Admin Only)
**PUT** `/api/auth/users/:id`

Update user information.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "full_name": "Updated Name",
  "role": "admin",
  "is_active": false
}
```

---

### 7. Change Password
**PUT** `/api/auth/change-password`

Change your own password.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "current_password": "admin123",
  "new_password": "newSecurePassword123"
}
```

---

### 8. Delete User (Admin Only)
**DELETE** `/api/auth/users/:id`

Soft delete a user (sets is_active to false).

**Headers:**
```
Authorization: Bearer <admin-token>
```

---

## User Roles

### Admin
- Full access to all endpoints
- Can create, read, update, and delete users
- Can manage all system resources

### User
- Access to POS operations
- Can view and create transactions
- Cannot manage users or system settings

---

## Using Authentication in Frontend

### Store Token
After login, store the token in localStorage:

```javascript
const response = await fetch('https://onestopposbackend.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});

const data = await response.json();
localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));
```

### Include Token in Requests
Add Authorization header to all protected requests:

```javascript
const token = localStorage.getItem('token');

const response = await fetch('https://onestopposbackend.onrender.com/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Check User Role
```javascript
const user = JSON.parse(localStorage.getItem('user'));

if (user.role === 'admin') {
  // Show admin features
} else {
  // Show user features
}
```

### Logout
```javascript
localStorage.removeItem('token');
localStorage.removeItem('user');
// Redirect to login page
```

---

## Database Table: users

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| username | VARCHAR(50) | Unique username |
| email | VARCHAR(255) | Unique email |
| password | VARCHAR(255) | Hashed password (bcrypt) |
| full_name | VARCHAR(255) | User's full name |
| role | VARCHAR(20) | 'admin' or 'user' |
| is_active | BOOLEAN | Account active status |
| last_login | TIMESTAMP | Last login time |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

---

## Security Notes

1. **JWT Token expires in 24 hours** - Users need to login again after expiration
2. **Passwords are hashed** with bcrypt (10 rounds)
3. **Change JWT_SECRET** in production environment
4. **Change default admin password** immediately after deployment
5. **Use HTTPS** in production to protect tokens in transit

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Admin access required"
}
```

### 400 Bad Request
```json
{
  "error": "Username and password are required"
}
```

---

## Environment Variables

Add to your `.env` file:

```env
JWT_SECRET=your-secret-key-here
```

In Render dashboard, add:
- `JWT_SECRET` = `your-random-secret-key-change-in-production`

---

## Testing with curl

### Login
```bash
curl -X POST https://onestopposbackend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Get Protected Resource
```bash
curl https://onestopposbackend.onrender.com/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create User
```bash
curl -X POST https://onestopposbackend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "username":"cashier1",
    "email":"cashier1@example.com",
    "password":"password123",
    "full_name":"John Doe",
    "role":"user"
  }'
```
