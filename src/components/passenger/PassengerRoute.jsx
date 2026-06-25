import React, { useState, useEffect } from 'react';
import { cityStops, getRoutesByCity } from '../../data/cityStops';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import './PassengerRoute.css';

const PassengerRoute = () => {
  const navigate = useNavigate();
  const [routeData, setRouteData] = useState({
    city: '',
    startingPoint: '',
    destination: ''
  });
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [availableStops, setAvailableStops] = useState([]);
  const [error, setError] = useState('');

  // Load routes from Firebase when city changes
  useEffect(() => {
    if (!routeData.city) {
      setAvailableRoutes([]);
      setFilteredRoutes([]);
      setAvailableStops([]);
      return;
    }

    let unsubscribe;
    
    try {
      const routesRef = ref(db, `routes/${routeData.city}`);
      unsubscribe = onValue(routesRef, (snapshot) => {
        if (snapshot.exists()) {
          const routesData = snapshot.val();
          // Convert object to array and sort by routeId
          const routesArray = Object.values(routesData).sort((a, b) => a.routeId - b.routeId);
          setAvailableRoutes(routesArray);
          
          // Extract unique stops from all routes
          const stopsSet = new Set();
          routesArray.forEach(route => {
            route.stops?.forEach(stop => {
              stopsSet.add(stop.name);
            });
          });
          setAvailableStops(Array.from(stopsSet).sort());
        } else {
          // Fallback to static data if no Firebase routes
          const staticRoutes = getRoutesByCity(routeData.city);
          setAvailableRoutes(staticRoutes || []);
          
          // Extract stops from static data
          const staticStops = cityStops[routeData.city] || [];
          setAvailableStops(staticStops.map(s => s.name).sort());
        }
      });
    } catch (error) {
      console.error('Error loading routes:', error);
      // Fallback to static data
      const staticRoutes = getRoutesByCity(routeData.city);
      setAvailableRoutes(staticRoutes || []);
      
      const staticStops = cityStops[routeData.city] || [];
      setAvailableStops(staticStops.map(s => s.name).sort());
    }
    
    // Cleanup: unsubscribe from Firebase listener
    return () => {
      if (unsubscribe) {
        console.log('🧹 PassengerRoute: Cleaned up Firebase listener');
        unsubscribe();
      }
    };
  }, [routeData.city]);

  // Filter routes based on selected source and destination
  useEffect(() => {
    if (!routeData.startingPoint || !routeData.destination) {
      setFilteredRoutes(availableRoutes);
      return;
    }

    // Filter routes that have both source and destination stops
    const filtered = availableRoutes.filter(route => {
      const routeStopNames = route.stops.map(s => s.name);
      const hasSource = routeStopNames.includes(routeData.startingPoint);
      const hasDestination = routeStopNames.includes(routeData.destination);
      
      // Check if source comes before destination in the route
      const sourceIndex = routeStopNames.indexOf(routeData.startingPoint);
      const destIndex = routeStopNames.indexOf(routeData.destination);
      
      return hasSource && hasDestination && sourceIndex < destIndex;
    });

    setFilteredRoutes(filtered);
  }, [routeData.startingPoint, routeData.destination, availableRoutes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRouteData({
      ...routeData,
      [name]: value
    });
    setError(''); // Clear error when user changes input
    // Reset dependent fields if city changes
    if (name === 'city') {
      setRouteData({ city: value, startingPoint: '', destination: '' });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate if selected route exists with correct direction
    if (filteredRoutes.length === 0) {
      setError(`❌ No routes available between "${routeData.startingPoint}" and "${routeData.destination}". Please select different stops.`);
      return;
    }
    
    // Route is valid, proceed
    setError('');
    localStorage.setItem('passengerRoute', JSON.stringify(routeData));
    navigate('/passenger/buses');
  };

  return (
    <div className="passenger-route-container">
      <div style={{ position: 'absolute', top: 20, left: 30, fontWeight: 'bold', fontSize: '2rem', color: '#fff', letterSpacing: '2px', zIndex: 100 }}>
        Transit Tracker
      </div>
      <button 
        onClick={() => navigate('/')}
        className="home-button"
      >
        Home
      </button>
  <h1 style={{ marginTop: 80, color: '#fff' }}>Find Your Bus</h1>
      {error && (
        <div style={{
          backgroundColor: '#ff6b6b',
          color: '#fff',
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          fontWeight: '500',
          marginLeft: '20px',
          marginRight: '20px'
        }}>
          {error}
        </div>
      )}
      <div className="route-form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="city">City:</label>
            <select
              id="city"
              name="city"
              value={routeData.city}
              onChange={handleChange}
              required
            >
              <option value="">Select City</option>
              {Object.keys(cityStops).map(city => (
                <option key={city} value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>
              ))}
            </select>
          </div>
          {routeData.city && (
            <>
              <div className="form-group">
                <label htmlFor="startingPoint">From:</label>
                <select
                  id="startingPoint"
                  name="startingPoint"
                  value={routeData.startingPoint}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Source Stop</option>
                  {availableStops.map(stop => (
                    <option key={stop} value={stop}>{stop}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="destination">To:</label>
                <select
                  id="destination"
                  name="destination"
                  value={routeData.destination}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Destination Stop</option>
                  {availableStops.map(stop => (
                    <option key={stop} value={stop}>{stop}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <button type="submit" className="search-button">
            Find Buses
          </button>
        </form>
      </div>
    </div>
  );
};

export default PassengerRoute;