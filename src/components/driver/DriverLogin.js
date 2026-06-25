import React, { useState, useEffect } from 'react';
import { cityStops, getRoutesByCity } from '../../data/cityStops';
import { useNavigate } from 'react-router-dom';
import { initializeSampleDrivers, authenticateDriver } from '../../services/DriverService';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import './DriverLogin.css';

const DriverLogin = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [routeData, setRouteData] = useState({
    city: '',
    routeId: ''
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [driverInfo, setDriverInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);

  const handleCredentialChange = (e) => {
    const { name, value } = e.target;
    setCredentials({
      ...credentials,
      [name]: value
    });
    setError(''); // Clear error when user types
  };

  const handleRouteChange = (e) => {
    const { name, value } = e.target;
    setRouteData({
      ...routeData,
      [name]: value
    });
    // Reset route if city changes
    if (name === 'city') {
      setRouteData({ ...routeData, city: value, routeId: '' });
      // Note: loadRoutesFromFirebase is now called in useEffect on city change
    }
  };

  // Cleanup Firebase listener when city changes in routeData
  useEffect(() => {
    if (!routeData.city) return;
    
    const unsubscribe = loadRoutesFromFirebase(routeData.city);
    
    // Cleanup: unsubscribe from Firebase listener when city changes or component unmounts
    return () => {
      if (unsubscribe) {
        console.log('🧹 DriverLogin: Cleaned up Firebase listener');
        unsubscribe();
      }
    };
  }, [routeData.city]);

  const loadRoutesFromFirebase = (city) => {
    try {
      const routesRef = ref(db, `routes/${city}`);
      const unsubscribe = onValue(routesRef, (snapshot) => {
        if (snapshot.exists()) {
          const routesData = snapshot.val();
          // Convert object to array and sort by routeId
          const routesArray = Object.values(routesData).sort((a, b) => String(a.routeId).localeCompare(String(b.routeId)));
          setRoutes(routesArray);
        } else {
          // No routes in Firebase, use static data as fallback
          const staticRoutes = getRoutesByCity(city);
          setRoutes(staticRoutes);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error loading routes:', error);
      // Fallback to static data
      const staticRoutes = getRoutesByCity(city);
      setRoutes(staticRoutes);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Initialize sample drivers if they don't exist (for demo purposes)
      await initializeSampleDrivers();
      
      // Authenticate driver using the service
      const driverData = await authenticateDriver(credentials.username, credentials.password);
      
      // Authentication successful
      setDriverInfo(driverData);
      setIsAuthenticated(true);
      setError('');
    } catch (error) {
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSubmit = (e) => {
    e.preventDefault();
    
    // Find the selected route object
    const selectedRoute = routes.find(route => String(route.routeId) === String(routeData.routeId));
    
    // Combine driver info with route data
    const completeDriverInfo = {
      ...driverInfo,
      city: routeData.city,
      routeId: routeData.routeId,
      route: selectedRoute?.routeName || '',
      startingPoint: selectedRoute?.startStop || '',
      destination: selectedRoute?.endStop || '',
      vehicleName: driverInfo.vehicleNumber,
      name: driverInfo.driverName
    };
    
    // Store complete driver info in localStorage
    localStorage.setItem('driverInfo', JSON.stringify(completeDriverInfo));
    navigate('/driver/tracking');
  };

  return (
    <div className="driver-login-container">
      <div style={{ position: 'absolute', top: 20, left: 30, fontWeight: 'bold', fontSize: '2rem', color: '#fff', letterSpacing: '2px', zIndex: 100 }}>
        Transit Tracker
      </div>
      <button 
        onClick={() => navigate('/')}
        className="home-button"
      >
        Home
      </button>
      <h1 style={{ marginTop: 80 }}>Driver Login</h1>
      
      {!isAuthenticated ? (
        <div className="driver-form-container">
          <form onSubmit={handleLogin}>
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleCredentialChange}
                required
                placeholder="Enter your username"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleCredentialChange}
                required
                placeholder="Enter your password"
              />
            </div>
            
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="demo-credentials">
            <h3>Demo Credentials:</h3>
            <p><strong>Username:</strong> driver001 | <strong>Password:</strong> password123</p>
            <p><strong>Username:</strong> driver002 | <strong>Password:</strong> secure456</p>
          </div>
        </div>
      ) : (
        <div className="driver-form-container">
          <div className="welcome-message">
            <h2>Welcome, {driverInfo.driverName}!</h2>
            <p><strong>Vehicle:</strong> {driverInfo.vehicleNumber}</p>
            <p>Please select your route details:</p>
          </div>
          
          <form onSubmit={handleRouteSubmit}>
            <div className="form-group">
              <label htmlFor="city">City:</label>
              <select
                id="city"
                name="city"
                value={routeData.city}
                onChange={handleRouteChange}
                required
              >
                <option value="">Select City</option>
                {Object.keys(cityStops).map(city => (
                  <option key={city} value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>
                ))}
              </select>
            </div>
            
            {routeData.city && (
              <div className="form-group">
                <label htmlFor="routeId">Route:</label>
                <select
                  id="routeId"
                  name="routeId"
                  value={routeData.routeId}
                  onChange={handleRouteChange}
                  required
                >
                  <option value="">Select Route</option>
                  {routes?.map(route => (
                    <option key={route.routeId} value={route.routeId}>
                      {route.routeName} - {route.startStop} to {route.endStop}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button type="submit" className="submit-button">
              Start Sharing Location
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default DriverLogin;