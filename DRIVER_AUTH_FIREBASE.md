# Driver Authentication System - Firebase Integration

## Overview
The Transit Tracker now uses Firebase Realtime Database to store and manage driver credentials instead of local JavaScript files. This provides a more scalable and secure solution for institutions to manage their drivers.

## Firebase Database Structure

### Driver Credentials Path: `/driverCredentials/{username}`

```json
{
  "driverCredentials": {
    "driver001": {
      "username": "driver001",
      "password": "password123",
      "vehicleNumber": "KA-01-HH-1234",
      "driverName": "John Doe",
      "phoneNumber": "+91-9876543210",
      "licenseNumber": "KA1234567890",
      "isActive": true,
      "assignedRoutes": ["Route 42", "Route 15"],
      "createdAt": "2025-09-26T00:00:00Z",
      "updatedAt": "2025-09-26T00:00:00Z"
    }
  }
}
```

## Features

### 1. **Firebase Integration**
- All driver credentials are stored in Firebase Realtime Database
- Real-time updates and synchronization
- Scalable and secure cloud storage

### 2. **Driver Authentication**
- Username/password based login
- Active status validation
- Secure authentication flow

### 3. **Admin Management**
- Add new drivers
- Activate/deactivate driver accounts
- View all drivers
- Update driver information

## Demo Credentials

For testing purposes, sample credentials are automatically added to Firebase:

| Username | Password | Vehicle | Status |
|----------|----------|---------|---------|
| driver001 | password123 | KA-01-HH-1234 | Active |
| driver002 | secure456 | KA-02-AB-5678 | Active |
| driver003 | test789 | MH-12-CD-9012 | Inactive |

## Files Structure

```
src/
├── services/
│   └── DriverService.js          # Firebase driver operations
├── utils/
│   └── AdminUtils.js             # Admin utility functions
└── components/
    └── driver/
        ├── DriverLogin.js        # Updated login component
        └── DriverTracking.js     # Driver tracking interface
```

## Services Available

### DriverService.js
- `initializeSampleDrivers()` - Initialize demo data
- `authenticateDriver(username, password)` - Authenticate driver
- `addDriver(driverData)` - Add new driver (admin)
- `updateDriverStatus(username, isActive)` - Update driver status
- `getAllDrivers()` - Get all drivers (admin)

### AdminUtils.js
- `addNewDriver(driverDetails)` - Add driver wrapper
- `activateDriver(username)` - Activate driver
- `deactivateDriver(username)` - Deactivate driver
- `getDriversForAdmin()` - Get drivers for admin dashboard

## How Institutions Can Add Drivers

### Method 1: Using Admin Utils
```javascript
import { addNewDriver } from '../utils/AdminUtils';

const result = await addNewDriver({
  username: 'driver004',
  password: 'securepassword',
  vehicleNumber: 'KA-04-XY-9999',
  driverName: 'New Driver',
  phoneNumber: '+91-9999999999',
  licenseNumber: 'KA1122334456',
  assignedRoutes: ['Route 100']
});
```

### Method 2: Direct Firebase Addition
Institutions can add drivers directly to the Firebase database under the path `/driverCredentials/{username}` with the required structure.

### Method 3: Admin Panel (Future Enhancement)
A dedicated admin panel can be built using the provided services for easier driver management.

## Security Considerations

### Current Implementation
- Passwords are stored in plain text for demo purposes
- Basic username/password authentication

### Production Recommendations
- **Hash passwords** using bcrypt or similar
- **Implement JWT tokens** for session management
- **Add role-based access control**
- **Enable Firebase Security Rules**
- **Use HTTPS** for all communications
- **Implement password policies**

## Firebase Security Rules Example

```json
{
  "rules": {
    "driverCredentials": {
      ".read": "auth != null && auth.token.admin == true",
      ".write": "auth != null && auth.token.admin == true"
    },
    "buses": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## Environment Setup

Make sure your Firebase configuration is properly set in `src/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebasedatabase.app",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Testing the System

1. **Start the application**: `npm start`
2. **Navigate to Driver Login**: Click "Driver" on landing page
3. **Use demo credentials** to test authentication
4. **Complete route selection** after successful login
5. **Start location sharing** to test tracking

The system now provides a complete Firebase-integrated driver authentication solution ready for institutional deployment.