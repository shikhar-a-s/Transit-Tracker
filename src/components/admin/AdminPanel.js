import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { busRoutes, cityStops, getRoutesByCity, getRouteById } from '../../data/cityStops';
import { geocodeAddress } from '../../services/GeocodeService';
import { db } from '../../firebase';
import { ref, set, remove, onValue } from 'firebase/database';
import './AdminPanel.css';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [adminInfo, setAdminInfo] = useState(null);
  const [selectedCity, setSelectedCity] = useState('bangalore');
  const [routes, setRoutes] = useState(getRoutesByCity('bangalore'));
  const [newRoute, setNewRoute] = useState({
    routeId: '',
    routeName: '',
    startStop: '',
    endStop: '',
    stops: []
  });
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [message, setMessage] = useState('');
  const [customStopInput, setCustomStopInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionTimeout, setSuggestionTimeout] = useState(null);
  const [manualCoordinatesMode, setManualCoordinatesMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualStopName, setManualStopName] = useState('');
  const [editingStopIndex, setEditingStopIndex] = useState(null);
  const [editingRouteForStop, setEditingRouteForStop] = useState(null);
  const [editStopName, setEditStopName] = useState('');
  const [editStopLat, setEditStopLat] = useState('');
  const [editStopLon, setEditStopLon] = useState('');
  const [addingStopToRoute, setAddingStopToRoute] = useState(null);
  const [newStopName, setNewStopName] = useState('');
  const [newStopLat, setNewStopLat] = useState('');
  const [newStopLon, setNewStopLon] = useState('');
  const [newStopOrder, setNewStopOrder] = useState('');

  // Check if admin is logged in
  useEffect(() => {
    const storedAdminInfo = localStorage.getItem('adminInfo');
    if (!storedAdminInfo) {
      // Redirect to admin login if not authenticated
      navigate('/admin/login');
      return;
    }
    setAdminInfo(JSON.parse(storedAdminInfo));
    // Set initial city based on admin's accessible cities
    const adminData = JSON.parse(storedAdminInfo);
    if (adminData.cities && adminData.cities.length > 0) {
      setSelectedCity(adminData.cities[0]);
      // Load routes from Firebase for the initial city
      loadRoutesFromFirebase(adminData.cities[0]);
    }
  }, [navigate]);

  // Load routes from Firebase when city changes
  useEffect(() => {
    const unsubscribe = loadRoutesFromFirebase(selectedCity);
    
    // Cleanup: unsubscribe from Firebase listener when city changes or component unmounts
    return () => {
      if (unsubscribe) {
        console.log('🧹 Cleaning up Firebase listener for city:', selectedCity);
        unsubscribe();
      }
    };
  }, [selectedCity]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimeout) {
        clearTimeout(suggestionTimeout);
      }
    };
  }, [suggestionTimeout]);

  const loadRoutesFromFirebase = (city) => {
    try {
      const routesRef = ref(db, `routes/${city}`);
      const unsubscribe = onValue(routesRef, (snapshot) => {
        if (snapshot.exists()) {
          const routesData = snapshot.val();
          // Convert object to array
          const routesArray = Object.values(routesData).sort((a, b) => a.routeId - b.routeId);
          console.log(`🟢 Routes loaded from FIREBASE for ${city}:`, routesArray);
          setRoutes(routesArray);
        } else {
          // No routes in Firebase, use static data as fallback
          const staticRoutes = getRoutesByCity(city);
          console.warn(`🟡 No routes in Firebase for ${city}. Using STATIC DATA fallback:`, staticRoutes);
          console.warn('⚠️ Delete will NOT work on static routes. Create a new route to test deletion.');
          setRoutes(staticRoutes);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error loading routes from Firebase:', error);
      // Fallback to static data
      const staticRoutes = getRoutesByCity(city);
      console.warn('🔴 Firebase error. Using static data fallback:', staticRoutes);
      setRoutes(staticRoutes);
    }
  };

  const handleCityChange = (e) => {
    const city = e.target.value;
    setSelectedCity(city);
    setRoutes(getRoutesByCity(city));
    resetForm();
  };

  const handleRouteInputChange = (e) => {
    const { name, value } = e.target;
    setNewRoute({
      ...newRoute,
      [name]: value
    });
  };

  const handleAddStop = (stopName) => {
    const stop = cityStops[selectedCity]?.find(s => s.name === stopName);
    if (stop && !newRoute.stops.find(s => s.name === stopName)) {
      const order = newRoute.stops.length + 1;
      setNewRoute({
        ...newRoute,
        stops: [...newRoute.stops, { ...stop, order }]
      });
      setMessage(`✅ Added ${stopName} to route`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveStop = (stopName) => {
    const updatedStops = newRoute.stops
      .filter(s => s.name !== stopName)
      .map((s, index) => ({ ...s, order: index + 1 }));
    setNewRoute({
      ...newRoute,
      stops: updatedStops
    });
  };

  // Edit/Remove stops from existing routes
  const handleEditStopClick = (route, stopIndex) => {
    const stop = route.stops[stopIndex];
    setEditingRouteForStop(route.routeId);
    setEditingStopIndex(stopIndex);
    setEditStopName(stop.name);
    setEditStopLat(stop.coords ? stop.coords[0] : '');
    setEditStopLon(stop.coords ? stop.coords[1] : '');
  };

  const handleSaveEditStop = async () => {
    if (!editStopName.trim()) {
      setMessage('❌ Stop name cannot be empty');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const lat = parseFloat(editStopLat);
    const lon = parseFloat(editStopLon);

    if (isNaN(lat) || isNaN(lon)) {
      setMessage('❌ Please enter valid latitude and longitude');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setMessage('❌ Coordinates out of range');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const routeToUpdate = routes.find(r => r.routeId === editingRouteForStop);
      if (!routeToUpdate) return;

      const updatedStops = routeToUpdate.stops.map((stop, idx) =>
        idx === editingStopIndex
          ? { ...stop, name: editStopName, coords: [lat, lon] }
          : stop
      );

      const updatedRoute = { ...routeToUpdate, stops: updatedStops };

      // Save to Firebase
      await set(ref(db, `routes/${selectedCity}/${editingRouteForStop}`), updatedRoute);
      
      // Update local state
      setRoutes(routes.map(r => r.routeId === editingRouteForStop ? updatedRoute : r));

      setMessage(`✅ Stop "${editStopName}" updated successfully`);
      setEditingRouteForStop(null);
      setEditingStopIndex(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error updating stop');
      console.error('Error updating stop:', error);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveStopFromRoute = async (routeId, stopIndex) => {
    try {
      const routeToUpdate = routes.find(r => r.routeId === routeId);
      if (!routeToUpdate) return;

      const removedStopName = routeToUpdate.stops[stopIndex].name;
      const updatedStops = routeToUpdate.stops
        .filter((_, idx) => idx !== stopIndex)
        .map((stop, idx) => ({ ...stop, order: idx + 1 }));

      const updatedRoute = { ...routeToUpdate, stops: updatedStops };

      // Save to Firebase
      await set(ref(db, `routes/${selectedCity}/${routeId}`), updatedRoute);

      // Update local state
      setRoutes(routes.map(r => r.routeId === routeId ? updatedRoute : r));

      setMessage(`✅ Removed "${removedStopName}" from route`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error removing stop');
      console.error('Error removing stop:', error);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAddStopToExistingRoute = async () => {
    if (!newStopName.trim()) {
      setMessage('❌ Stop name cannot be empty');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const lat = parseFloat(newStopLat);
    const lon = parseFloat(newStopLon);
    const order = parseInt(newStopOrder);

    if (isNaN(lat) || isNaN(lon)) {
      setMessage('❌ Please enter valid latitude and longitude');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setMessage('❌ Coordinates out of range');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (isNaN(order) || order < 1) {
      setMessage('❌ Please enter a valid stop order (1 or higher)');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      const routeToUpdate = routes.find(r => r.routeId === addingStopToRoute);
      if (!routeToUpdate) return;

      // Check if order is within valid range
      if (order > routeToUpdate.stops.length + 1) {
        setMessage(`❌ Order cannot exceed ${routeToUpdate.stops.length + 1}`);
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const newStop = {
        name: newStopName.trim(),
        coords: [lat, lon],
        order: order
      };

      // Insert the new stop and re-order affected stops
      const updatedStops = [];
      routeToUpdate.stops.forEach((stop, idx) => {
        if (idx + 1 >= order) {
          updatedStops.push({ ...stop, order: stop.order + 1 });
        } else {
          updatedStops.push(stop);
        }
      });
      updatedStops.splice(order - 1, 0, newStop);

      const updatedRoute = { ...routeToUpdate, stops: updatedStops };

      // Save to Firebase
      await set(ref(db, `routes/${selectedCity}/${addingStopToRoute}`), updatedRoute);

      // Update local state
      setRoutes(routes.map(r => r.routeId === addingStopToRoute ? updatedRoute : r));

      setMessage(`✅ Added "${newStopName}" at position ${order}`);
      setAddingStopToRoute(null);
      setNewStopName('');
      setNewStopLat('');
      setNewStopLon('');
      setNewStopOrder('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error adding stop');
      console.error('Error adding stop:', error);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAddressInputChange = (e) => {
    const value = e.target.value;
    setCustomStopInput(value);

    // Clear existing timeout
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce API calls - wait 500ms after user stops typing
    const timeout = setTimeout(async () => {
      try {
        let suggestions = [];

        // Try search with city first (for specific results)
        try {
          const response1 = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}, ${selectedCity}&format=json&limit=10&addressdetails=1`,
            { headers: { 'User-Agent': 'TransitTracker' } }
          );
          const data1 = await response1.json();
          suggestions = data1.slice(0, 5);
        } catch (error) {
          console.error('City search failed:', error);
        }

        // If no results with city, try broader search
        if (suggestions.length === 0) {
          try {
            const response2 = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=10&addressdetails=1`,
              { headers: { 'User-Agent': 'TransitTracker' } }
            );
            const data2 = await response2.json();
            suggestions = data2.slice(0, 5);
          } catch (error) {
            console.error('Broader search failed:', error);
          }
        }

        if (suggestions.length > 0) {
          const formattedSuggestions = suggestions.map(item => ({
            display_name: item.display_name,
            lat: item.lat,
            lon: item.lon,
            name: item.name || item.display_name.split(',')[0],
            type: item.type || 'location'
          }));
          setSuggestions(formattedSuggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
    }, 500);

    setSuggestionTimeout(timeout);
  };

  const handleSuggestionSelect = (suggestion) => {
    setCustomStopInput(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddManualStop = (e) => {
    e.preventDefault();

    if (!manualStopName.trim()) {
      setMessage('❌ Please enter a stop name/address');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (isNaN(lat) || isNaN(lon)) {
      setMessage('❌ Please enter valid latitude and longitude');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setMessage('❌ Coordinates out of range (Lat: -90 to 90, Lon: -180 to 180)');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const order = newRoute.stops.length + 1;
    const newStop = {
      name: manualStopName,
      coords: [lat, lon],  // Store as [latitude, longitude] array for map display
      order
    };

    setNewRoute({
      ...newRoute,
      stops: [...newRoute.stops, newStop]
    });

    setMessage(`✅ Added "${manualStopName}" at [${lat}, ${lon}] to route`);
    console.log('📍 Stop with coordinates added:', newStop);
    setManualStopName('');
    setManualLat('');
    setManualLon('');
    setManualCoordinatesMode(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddCustomStop = async (e) => {
    e.preventDefault();
    
    if (!customStopInput.trim()) {
      setMessage('❌ Please enter an address');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsGeocoding(true);
    try {
      const geocodedStop = await geocodeAddress(customStopInput, selectedCity);
      
      const order = newRoute.stops.length + 1;
      const newStop = {
        name: geocodedStop.name,
        coords: [geocodedStop.latitude, geocodedStop.longitude],  // Store as [lat, lng] array
        order
      };

      setNewRoute({
        ...newRoute,
        stops: [...newRoute.stops, newStop]
      });

      setMessage(`✅ Added "${geocodedStop.name}" to route`);
      console.log('📍 Geocoded stop added:', newStop);
      setCustomStopInput('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      // Auto-switch to manual coordinates mode on failure
      setManualStopName(customStopInput);
      setManualCoordinatesMode(true);
      setMessage(`⚠️ Location not found. Use Manual Coordinates below to add "${customStopInput}"`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();

    if (!newRoute.routeId || !newRoute.routeName || newRoute.stops.length < 2) {
      setMessage('❌ Please fill all fields and add at least 2 stops');
      return;
    }

    try {
      const routeData = {
        routeId: newRoute.routeId,
        routeName: newRoute.routeName,
        startStop: newRoute.stops[0]?.name,
        endStop: newRoute.stops[newRoute.stops.length - 1]?.name,
        stops: newRoute.stops,
        createdAt: new Date().toISOString()
      };

      // Log stops with coordinates for verification
      console.log('🛑 STOP COORDINATES VERIFICATION:');
      newRoute.stops.forEach(stop => {
        console.log(`  ✅ ${stop.name}: [${stop.coords?.[0]}, ${stop.coords?.[1]}]`);
      });

      // Save to Firebase
      const routeRef = ref(db, `routes/${selectedCity}/${newRoute.routeId}`);
      console.log(`💾 Saving route to Firebase at: routes/${selectedCity}/${newRoute.routeId}`);
      await set(routeRef, routeData);

      setMessage('✅ Route saved to Firebase!');
      console.log('🗂️ Firebase path: routes/' + selectedCity + '/' + newRoute.routeId, routeData);
      
      resetForm();
      // Routes will auto-update via the onValue listener
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving route:', error);
      setMessage('❌ Error saving route. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm(`Are you sure you want to delete Route ${routeId}? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log(`🗑️ Deleting Route ${routeId} from Firebase at: routes/${selectedCity}/${routeId}`);
      const routeRef = ref(db, `routes/${selectedCity}/${routeId}`);
      await remove(routeRef);

      // Remove from local state immediately for better UX
      const updatedRoutes = routes.filter(route => route.routeId !== routeId);
      setRoutes(updatedRoutes);

      setMessage(`✅ Route ${routeId} deleted successfully from Firebase!`);
      console.log('🗂️ Route deleted. Check Firebase Console to confirm.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('❌ Error deleting route from Firebase:', error);
      setMessage(`❌ Deletion failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const resetForm = () => {
    setNewRoute({
      routeId: '',
      routeName: '',
      startStop: '',
      endStop: '',
      stops: []
    });
    setEditingRouteId(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminInfo');
    navigate('/admin/login');
  };

  return (
    <div className="admin-panel-container">
      <div style={{ position: 'absolute', top: 20, left: 30, fontWeight: 'bold', fontSize: '2rem', color: '#fff', letterSpacing: '2px' }}>
        Transit Tracker Admin
      </div>
      
      {adminInfo && (
        <div style={{ position: 'absolute', top: 20, right: 30, color: '#fff', textAlign: 'right', zIndex: 100 }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><strong>{adminInfo.adminName}</strong></p>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem' }}>{adminInfo.company}</p>
          <button 
            onClick={handleLogout}
            style={{ 
              background: 'rgb(184, 20, 20)', 
              color: 'white', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              borderRadius: '5px', 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Logout
          </button>
        </div>
      )}

      <h1 style={{ marginTop: 80 }}>Admin Panel - Route Management</h1>

      <div className="admin-content">
        {/* Add/Edit Route Form */}
        <div className="admin-section">
          <h2>Add New Route</h2>
          <form onSubmit={handleSaveRoute} className="route-form">
            {message && <div className="admin-message">{message}</div>}

            <div className="form-group">
              <label>Route ID (e.g., 1, 23, 42):</label>
              <input
                type="text"
                name="routeId"
                value={newRoute.routeId}
                onChange={handleRouteInputChange}
                placeholder="Enter route ID"
                required
              />
            </div>

            <div className="form-group">
              <label>Route Name (e.g., Route 1, Express 25):</label>
              <input
                type="text"
                name="routeName"
                value={newRoute.routeName}
                onChange={handleRouteInputChange}
                placeholder="Enter route name"
                required
              />
            </div>

            {/* Selected Stops */}
            <div className="form-group">
              <label>Route Stops (Current Order):</label>
              {newRoute.stops.length > 0 ? (
                <div className="selected-stops">
                  {newRoute.stops.map((stop, idx) => (
                    <div key={stop.name} className="selected-stop">
                      <span>{idx + 1}. {stop.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(stop.name)}
                        className="remove-btn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-stops">No stops selected yet</p>
              )}
            </div>

            {/* Available Stops */}
            <div className="form-group">
              <label>Available Stops in {selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)}:</label>
              <div className="available-stops">
                {cityStops[selectedCity]?.map(stop => (
                  <button
                    key={stop.name}
                    type="button"
                    onClick={() => handleAddStop(stop.name)}
                    className={`stop-btn ${newRoute.stops.find(s => s.name === stop.name) ? 'selected' : ''}`}
                    disabled={newRoute.stops.find(s => s.name === stop.name)}
                  >
                    {stop.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Custom Stop */}
            <div className="form-group">
              <label>Add Custom Stop (Enter Address or Coordinates):</label>
              
              {/* Mode Toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setManualCoordinatesMode(false)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: !manualCoordinatesMode ? '#007bff' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  🔍 Search Address
                </button>
                <button
                  type="button"
                  onClick={() => setManualCoordinatesMode(true)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: manualCoordinatesMode ? '#007bff' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  📍 Manual Coordinates
                </button>
              </div>

              {/* Search Mode */}
              {!manualCoordinatesMode && (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={customStopInput}
                      onChange={handleAddressInputChange}
                      placeholder="Enter address (e.g., Main Street Station, Bagalur)"
                      disabled={isGeocoding}
                      style={{ flex: 1 }}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomStop}
                      disabled={isGeocoding}
                      style={{
                        background: isGeocoding ? '#ccc' : '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '5px',
                        cursor: isGeocoding ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isGeocoding ? 'Searching...' : 'Search Stop'}
                    </button>
                  </div>

                  {/* Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>
                      {suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSuggestionSelect(suggestion)}
                          style={{
                            padding: '0.75rem',
                            borderBottom: idx < suggestions.length - 1 ? '1px solid #eee' : 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          <strong>{suggestion.name}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            {suggestion.display_name.substring(0, 60)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: '0.85rem', color: '#999', margin: '0.5rem 0 0 0' }}>
                    💡 Start typing to see suggestions. Can't find a location? Use Manual Coordinates.
                  </p>
                </div>
              )}

              {/* Manual Coordinates Mode */}
              {manualCoordinatesMode && (
                <div>
                  <div className="form-group">
                    <label>Stop Name/Address:</label>
                    <input
                      type="text"
                      value={manualStopName}
                      onChange={(e) => setManualStopName(e.target.value)}
                      placeholder="e.g., Bagalur Cross Bus Stand"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label>Latitude:</label>
                      <input
                        type="text"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="e.g., 13.2157"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Longitude:</label>
                      <input
                        type="text"
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        placeholder="e.g., 77.5900"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualStop}
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Add Stop with Coordinates
                  </button>
                  <p style={{ fontSize: '0.85rem', color: '#999', margin: '0.5rem 0 0 0' }}>
                    💡 Get coordinates from Google Maps. Right-click on the location and select the coordinates.
                  </p>
                </div>
              )}
            </div>

            <button type="submit" className="save-btn">
              Save Route
            </button>
            {editingRouteId && (
              <button type="button" onClick={resetForm} className="cancel-btn">
                Cancel Edit
              </button>
            )}
          </form>
        </div>

        {/* Existing Routes */}
        <div className="admin-section">
          <h2>Existing Routes in {selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)}</h2>
          <div className="routes-list">
            {routes.length > 0 ? (
              routes.map(route => (
                <div key={route.routeId} className="route-card">
                  <div className="route-header">
                    <div>
                      <strong>{route.routeName}</strong>
                      <span className="route-id">ID: {route.routeId}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRoute(route.routeId)}
                      className="delete-route-btn"
                      title="Delete this route"
                    >
                      Delete
                    </button>
                  </div>
                  <p><strong>Route:</strong> {route.startStop} → {route.endStop}</p>
                  <p><strong>Stops ({route.stops.length}):</strong></p>
                  <ul className="stops-list">
                    {route.stops.map((stop, idx) => (
                      <li key={stop.name} className="stop-item-with-actions">
                        <span>{stop.order}. {stop.name}</span>
                        <div className="stop-actions">
                          <button
                            type="button"
                            onClick={() => handleEditStopClick(route, idx)}
                            className="edit-stop-btn"
                            title="Edit this stop"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStopFromRoute(route.routeId, idx)}
                            className="remove-stop-btn"
                            title="Remove this stop"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  
                  {/* Edit Stop Form - Inside Route Card */}
                  {editingStopIndex !== null && editingRouteForStop === route.routeId && (
                    <div style={{ backgroundColor: '#f0f8ff', border: '2px solid #007bff', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', marginTop: '1rem' }}>
                      <h4 style={{ marginTop: 0 }}>Edit Stop Coordinates</h4>
                      <div className="form-group">
                        <label>Stop Name:</label>
                        <input
                          type="text"
                          value={editStopName}
                          onChange={(e) => setEditStopName(e.target.value)}
                          placeholder="Stop name"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <label>Latitude:</label>
                          <input
                            type="text"
                            value={editStopLat}
                            onChange={(e) => setEditStopLat(e.target.value)}
                            placeholder="e.g., 13.2157"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label>Longitude:</label>
                          <input
                            type="text"
                            value={editStopLon}
                            onChange={(e) => setEditStopLon(e.target.value)}
                            placeholder="e.g., 77.5900"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                          type="button"
                          onClick={handleSaveEditStop}
                          style={{
                            flex: 1,
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRouteForStop(null);
                            setEditingStopIndex(null);
                          }}
                          style={{
                            flex: 1,
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Add Stop or Add Stop Form */}
                  {addingStopToRoute === route.routeId ? (
                    <div className="add-stop-form">
                      <h4>Add New Stop</h4>
                      <input
                        type="text"
                        placeholder="Stop Name"
                        value={newStopName}
                        onChange={(e) => setNewStopName(e.target.value)}
                      />
                      <div className="add-stop-form-inputs">
                        <input
                          type="number"
                          placeholder="Latitude"
                          value={newStopLat}
                          onChange={(e) => setNewStopLat(e.target.value)}
                          step="0.0001"
                        />
                        <input
                          type="number"
                          placeholder="Longitude"
                          value={newStopLon}
                          onChange={(e) => setNewStopLon(e.target.value)}
                          step="0.0001"
                        />
                        <input
                          type="number"
                          placeholder="Order"
                          value={newStopOrder}
                          onChange={(e) => setNewStopOrder(e.target.value)}
                          min="1"
                          max={route.stops.length + 1}
                        />
                      </div>
                      <div className="add-stop-form-buttons">
                        <button
                          type="button"
                          onClick={handleAddStopToExistingRoute}
                          style={{
                            background: '#28a745',
                            color: 'white'
                          }}
                        >
                          ✅ Add Stop
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingStopToRoute(null);
                            setNewStopName('');
                            setNewStopLat('');
                            setNewStopLon('');
                            setNewStopOrder('');
                          }}
                          style={{
                            background: '#6c757d',
                            color: 'white'
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingStopToRoute(route.routeId)}
                      style={{
                        width: '100%',
                        marginTop: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      + Add Stop
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="no-routes">No routes defined for this city yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="admin-footer">
        <p>💡 <strong>How it works:</strong> Define routes with their stops. Drivers select route ID, passengers select start/end stops. If those stops are in the route, the bus appears to them automatically!</p>
      </div>
    </div>
  );
};

export default AdminPanel;
