// Admin utility for institutions to manage driver credentials
// This would typically be part of an admin panel or separate admin application

import { addDriver, updateDriverStatus, getAllDrivers } from '../services/DriverService';

// Example function to add a new driver (for institution admin use)
export const addNewDriver = async (driverDetails) => {
  try {
    await addDriver({
      username: driverDetails.username,
      password: driverDetails.password, // Should be hashed in production
      vehicleNumber: driverDetails.vehicleNumber,
      driverName: driverDetails.driverName,
      phoneNumber: driverDetails.phoneNumber,
      licenseNumber: driverDetails.licenseNumber,
      isActive: true,
      assignedRoutes: driverDetails.assignedRoutes || []
    });
    return { success: true, message: 'Driver added successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Example function to deactivate a driver
export const deactivateDriver = async (username) => {
  try {
    await updateDriverStatus(username, false);
    return { success: true, message: 'Driver deactivated successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Example function to activate a driver
export const activateDriver = async (username) => {
  try {
    await updateDriverStatus(username, true);
    return { success: true, message: 'Driver activated successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Example function to get all drivers for admin dashboard
export const getDriversForAdmin = async () => {
  try {
    const drivers = await getAllDrivers();
    return { success: true, data: drivers };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Example usage:
/*
// Add a new driver
const result = await addNewDriver({
  username: 'driver004',
  password: 'newpassword123',
  vehicleNumber: 'KA-03-EF-1234',
  driverName: 'Alice Cooper',
  phoneNumber: '+91-9876543213',
  licenseNumber: 'KA9988776655',
  assignedRoutes: ['Route 101']
});

if (result.success) {
  console.log('Driver added:', result.message);
} else {
  console.error('Failed to add driver:', result.message);
}
*/