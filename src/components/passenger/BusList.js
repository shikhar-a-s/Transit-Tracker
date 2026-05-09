import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './BusList.css';
import { getCurrentPosition, calculateEstimatedArrival, watchPosition } from '../../services/LocationService';
import { getStopCoordinates, getRouteById, cityStops } from '../../data/cityStops';
import { getDirections } from '../../services/DirectionsService';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';

// Custom icons for bus and passenger
const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

const passengerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077063.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Custom icon for start destination (Green)
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom icon for end destination (Red)
const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Fix for Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Component to handle map center updates without remounting
const MapUpdater = ({ center, passengerPosition }) => {
  const map = useMap();
  const hasInitialized = React.useRef(false);
  
  useEffect(() => {
    if (map && passengerPosition && !hasInitialized.current) {
      // Initialize with passenger position, not the fallback center
      map.setView(passengerPosition, 14);
      hasInitialized.current = true;
      console.log('🗺️ Map initialized with PASSENGER LOCATION on first load:', passengerPosition);
    }
  }, [passengerPosition, map]);
  
  return null;
};

const BusList = () => {
  const navigate = useNavigate();
  const [passengerRoute, setPassengerRoute] = useState(null);
  const [buses, setBuses] = useState([]);
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // Default center
  const [selectedBus, setSelectedBus] = useState(null);
  const [passengerPosition, setPassengerPosition] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [startCoordinates, setStartCoordinates] = useState(null);
  const [endCoordinates, setEndCoordinates] = useState(null);
  const [routeStops, setRouteStops] = useState([]); // Store all stops in the selected route
  const [routeDirections, setRouteDirections] = useState(null);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [firebaseRoutes, setFirebaseRoutes] = useState({});
  const [routeExists, setRouteExists] = useState(true); // Track if valid routes exist for the selected from/to
  
  // Ref to store watch position ID for cleanup
  const watchIdRef = React.useRef(null);

  // Helper function to get route details from Firebase or static data
  const getRouteDetails = useCallback((city, routeId) => {
    // Try Firebase first
    if (firebaseRoutes[city] && firebaseRoutes[city][routeId]) {
      return firebaseRoutes[city][routeId];
    }
    // Fallback to static data
    return getRouteById(city, routeId);
  }, [firebaseRoutes]);

  // Helper function to normalize and compare stop names (handles whitespace, case differences)
  const normalizeStopName = useCallback((name) => {
    return name?.trim().toLowerCase() || '';
  }, []);

  const stopNamesMatch = useCallback((name1, name2) => {
    return normalizeStopName(name1) === normalizeStopName(name2);
  }, [normalizeStopName]);

  // Load all routes from Firebase for quick access
  useEffect(() => {
    const routes = {};
    const cityList = Object.keys(cityStops);
    const unsubscribes = []; // Store unsubscribe functions for cleanup
    
    const loadRoutesForCities = () => {
      cityList.forEach(city => {
        try {
          const routesRef = ref(db, `routes/${city}`);
          const unsubscribe = onValue(routesRef, (snapshot) => {
            if (snapshot.exists()) {
              routes[city] = snapshot.val();
            }
            setFirebaseRoutes({ ...routes });
          });
          unsubscribes.push(unsubscribe); // Store for cleanup
        } catch (error) {
          console.error(`Error loading routes for ${city}:`, error);
        }
      });
    };

    loadRoutesForCities();

    // Cleanup: unsubscribe from all Firebase listeners
    return () => {
      console.log('🧹 Cleaning up Firebase route listeners');
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Set passengerRoute only once on mount
  useEffect(() => {
    const storedRoute = localStorage.getItem('passengerRoute');
    if (!storedRoute) {
      navigate('/passenger');
      return;
    }
    setPassengerRoute(JSON.parse(storedRoute));
  }, [navigate]);

  // Get start and end destination coordinates from Firebase routes
  useEffect(() => {
    if (!passengerRoute || !passengerRoute.city || Object.keys(firebaseRoutes).length === 0) {
      console.log('Skipping coordinate lookup - missing data');
      return;
    }

    console.log('Looking up coordinates for:', passengerRoute.startingPoint, 'and', passengerRoute.destination);
    
    // Get all routes for this city
    const cityRoutes = firebaseRoutes[passengerRoute.city] ? Object.values(firebaseRoutes[passengerRoute.city]) : [];
    
    // Find the route that contains both start and end stops
    const selectedRoute = cityRoutes.find(route => {
      const routeStopNames = route.stops?.map(s => s.name) || [];
      const hasStart = routeStopNames.includes(passengerRoute.startingPoint);
      const hasEnd = routeStopNames.includes(passengerRoute.destination);
      return hasStart && hasEnd;
    });

    // Get intermediate stops for the selected route
    let allStops = [];
    if (selectedRoute) {
      const startIdx = selectedRoute.stops.findIndex(s => s.name === passengerRoute.startingPoint);
      const endIdx = selectedRoute.stops.findIndex(s => s.name === passengerRoute.destination);
      
      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        // Get all stops from start to end (inclusive)
        let stops = selectedRoute.stops.slice(startIdx, endIdx + 1);
        
        console.log('Firebase route stops BEFORE enrichment:', stops);
        
        // Enrich stops with coordinates from static data if missing
        allStops = stops.map(stop => {
          const staticCoords = getStopCoordinates(passengerRoute.city, stop.name);
          
          // Handle both coordinate formats:
          // 1. New format: coords: [lat, lng]
          // 2. Old format: latitude and longitude separate fields
          let enrichedCoords = stop.coords;
          if (!enrichedCoords && stop.latitude && stop.longitude) {
            enrichedCoords = [stop.latitude, stop.longitude];
            console.warn(`⚠️ Converting old format for "${stop.name}": [${stop.latitude}, ${stop.longitude}]`);
          }
          enrichedCoords = enrichedCoords || staticCoords;
          
          console.log(`Stop "${stop.name}": Firebase coords=${stop.coords}, Old format=[${stop.latitude}, ${stop.longitude}], Static=${staticCoords}, Using=${enrichedCoords}`);
          return {
            ...stop,
            coords: enrichedCoords
          };
        });
        
        console.log('Route stops AFTER enrichment:', allStops.map(s => ({ name: s.name, coords: s.coords })));
      }
    }
    
    // Find start and end coordinates
    const startStop = cityRoutes
      .flatMap(route => route.stops || [])
      .find(stop => stop.name === passengerRoute.startingPoint);
    
    const endStop = cityRoutes
      .flatMap(route => route.stops || [])
      .find(stop => stop.name === passengerRoute.destination);

    // Helper to normalize coordinates (handle both old latitude/longitude and new coords format)
    const normalizeCoords = (stop) => {
      if (!stop) return null;
      if (stop.coords && Array.isArray(stop.coords)) {
        return stop.coords;
      }
      if (stop.latitude && stop.longitude) {
        return [stop.latitude, stop.longitude];
      }
      return null;
    };

    const startCoords = normalizeCoords(startStop) || getStopCoordinates(passengerRoute.city, passengerRoute.startingPoint);
    const endCoords = normalizeCoords(endStop) || getStopCoordinates(passengerRoute.city, passengerRoute.destination);

    console.log('=== COORDINATE LOOKUP DEBUG ===');
    console.log('Selected starting point:', passengerRoute.startingPoint);
    console.log('Selected destination:', passengerRoute.destination);
    console.log('Start stop found in Firebase routes:', startStop ? { name: startStop.name, coords: startStop.coords } : 'NOT FOUND');
    console.log('End stop found in Firebase routes:', endStop ? { name: endStop.name, coords: endStop.coords } : 'NOT FOUND');
    console.log('Start coords from static data:', getStopCoordinates(passengerRoute.city, passengerRoute.startingPoint));
    console.log('End coords from static data:', getStopCoordinates(passengerRoute.city, passengerRoute.destination));
    console.log('FINAL Start coordinates:', startCoords);
    console.log('FINAL End coordinates:', endCoords);
    console.log('Route stops enriched:', allStops.map(s => ({ name: s.name, coords: s.coords })));
    
    setStartCoordinates(startCoords);
    setEndCoordinates(endCoords);
    setRouteStops(allStops);
  }, [passengerRoute, firebaseRoutes]);

  // Center map on passenger location when available (priority 1)
  useEffect(() => {
    if (passengerPosition) {
      console.log('🎯 Map recentering on passenger location:', passengerPosition);
      setMapCenter(passengerPosition);
    }
  }, [passengerPosition]);

  // Fallback: Center map on route midpoint if passenger location not available
  useEffect(() => {
    if (!passengerPosition && startCoordinates && endCoordinates) {
      const centerLat = (startCoordinates[0] + endCoordinates[0]) / 2;
      const centerLng = (startCoordinates[1] + endCoordinates[1]) / 2;
      console.log('📍 Map centered on route midpoint:', [centerLat, centerLng]);
      setMapCenter([centerLat, centerLng]);
    }
  }, [startCoordinates, endCoordinates, passengerPosition]);

  // Fetch actual route directions from OSRM with intermediate waypoints
  useEffect(() => {
    if (!startCoordinates || !endCoordinates) return;

    const fetchDirections = async () => {
      setLoadingDirections(true);
      
      // Extract intermediate waypoints (all stops between start and end, excluding start and end)
      const waypoints = [];
      if (routeStops.length > 2) {
        // routeStops already contains all stops from start to end
        // Skip the first (start) and last (end) stop
        for (let i = 1; i < routeStops.length - 1; i++) {
          if (routeStops[i].coords && Array.isArray(routeStops[i].coords)) {
            waypoints.push(routeStops[i].coords);
          }
        }
      }
      
      console.log('📍 Route waypoints:', waypoints.length > 0 ? waypoints.map(w => `[${w[0].toFixed(4)}, ${w[1].toFixed(4)}]`).join(', ') : 'None');
      
      const directions = await getDirections(startCoordinates, endCoordinates, waypoints);
      setRouteDirections(directions);
      setLoadingDirections(false);
    };

    fetchDirections();
  }, [startCoordinates, endCoordinates, routeStops]);

  // Check if valid routes exist for the selected from/to combination
  useEffect(() => {
    if (!passengerRoute?.city || !passengerRoute?.startingPoint || !passengerRoute?.destination || Object.keys(firebaseRoutes).length === 0) {
      return;
    }

    const city = passengerRoute.city;
    const passengerStart = passengerRoute.startingPoint;
    const passengerEnd = passengerRoute.destination;

    // Get all routes for the city
    const cityRoutes = firebaseRoutes[city] ? Object.values(firebaseRoutes[city]) : [];

    // Check if any route has both stops in correct direction
    const validRoutesExist = cityRoutes.some(route => {
      const routeStopNames = route.stops.map(s => s.name);
      const startInRoute = routeStopNames.includes(passengerStart);
      const endInRoute = routeStopNames.includes(passengerEnd);

      if (startInRoute && endInRoute) {
        const startIndex = routeStopNames.indexOf(passengerStart);
        const endIndex = routeStopNames.indexOf(passengerEnd);
        return startIndex < endIndex;
      }
      return false;
    });

    setRouteExists(validRoutesExist);
  }, [firebaseRoutes, passengerRoute]);

  // Watch passenger position separately (independent of route or buses)
  useEffect(() => {
    // Get passenger's initial position
    getCurrentPosition()
      .then(position => {
        setPassengerPosition([position.lat, position.lng]);
      })
      .catch(err => {
        console.error('Error getting initial passenger position:', err);
      });

    // Watch passenger position for continuous updates
    try {
      watchIdRef.current = watchPosition((position) => {
        setPassengerPosition([position.lat, position.lng]);
      });
      console.log('✅ Started watching passenger position, watchId:', watchIdRef.current);
    } catch (err) {
      console.error('Error watching position:', err);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log('🛑 Cleared watch position');
      }
    };
  }, []);

  // Main logic: fetch buses when route changes (only depends on passengerRoute, not position)
  useEffect(() => {
    if (!passengerRoute) return;

    // Fetch buses from Firebase
    const busesRef = ref(db, 'buses');
    const unsubscribe = onValue(busesRef, (snapshot) => {
      const busesData = snapshot.val() || {};
      
      const busList = Object.values(busesData).filter(bus => {
          // Check if bus data is fresh (updated within last 30 minutes)
          const busTimestamp = bus.timestamp ? new Date(bus.timestamp).getTime() : 0;
          const currentTime = Date.now();
          const thirtyMinutesInMs = 30 * 60 * 1000;
          const ageMs = currentTime - busTimestamp;
          
          // If bus timestamp is older than 30 minutes, it's likely stale data
          if (ageMs > thirtyMinutesInMs) {
            return false;
          }
          
          // Check if bus is on the same city as passenger
          if (bus.city !== passengerRoute?.city) {
            return false;
          }
          
          // Get the route details
          const routeDetails = getRouteDetails(bus.city, bus.routeId);
          if (!routeDetails) {
            return false;
          }
          
          // Check if passenger's start and end points are in this route's stops
          const passengerStart = passengerRoute?.startingPoint;
          const passengerEnd = passengerRoute?.destination;
          
          const routeStopNames = routeDetails.stops.map(s => s.name);
          
          // Use normalized comparison to handle whitespace and case differences
          const startInRoute = routeStopNames.some(stop => stopNamesMatch(stop, passengerStart));
          const endInRoute = routeStopNames.some(stop => stopNamesMatch(stop, passengerEnd));
          
          // Check if stops are in correct direction (start before end)
          if (startInRoute && endInRoute) {
            const startIndex = routeStopNames.findIndex(stop => stopNamesMatch(stop, passengerStart));
            const endIndex = routeStopNames.findIndex(stop => stopNamesMatch(stop, passengerEnd));
            
            if (startIndex < endIndex) {
              return true;
            } else {
              return false;
            }
          } else {
            return false;
          }
      });
      
      // Calculate ETA for each bus
      setPassengerPosition(prevPosition => {
        if (prevPosition) {
          const updatedBusList = busList.map(bus => {
            const estimatedArrivalMinutes = calculateEstimatedArrival(bus.position, prevPosition);
            const estimatedArrival = new Date(Date.now() + estimatedArrivalMinutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            return {
              ...bus,
              estimatedArrival,
              estimatedArrivalMinutes
            };
          });
          setBuses(updatedBusList);
          if (updatedBusList.length > 0) {
            setRoutePath([updatedBusList[0].position, prevPosition]);
          }
        } else {
          setBuses(busList);
        }
        return prevPosition;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [passengerRoute, getRouteDetails, stopNamesMatch]);

  // Update ETA whenever passenger position changes or buses are updated
  useEffect(() => {
    if (buses.length > 0 && passengerPosition) {
      const updatedBusList = buses.map(bus => {
        const estimatedArrivalMinutes = calculateEstimatedArrival(bus.position, passengerPosition);
        const estimatedArrival = new Date(Date.now() + estimatedArrivalMinutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        return {
          ...bus,
          estimatedArrival,
          estimatedArrivalMinutes
        };
      });
      setBuses(updatedBusList);
    }
  }, [passengerPosition]);

  const handleBusSelect = (bus) => {
    setSelectedBus(bus);
    setMapCenter(bus.position);

    // When a bus is selected, show its FULL route instead of passenger's selected portion
    if (bus.routeId && passengerRoute) {
      const fullRoute = getRouteDetails(passengerRoute.city, bus.routeId);
      
      if (fullRoute && fullRoute.stops && fullRoute.stops.length > 0) {
        // Get ALL stops from the bus route (not just passenger's start to end)
        const allStops = fullRoute.stops.map(stop => {
          const staticCoords = getStopCoordinates(passengerRoute.city, stop.name);
          
          let enrichedCoords = stop.coords;
          if (!enrichedCoords && stop.latitude && stop.longitude) {
            enrichedCoords = [stop.latitude, stop.longitude];
          }
          enrichedCoords = enrichedCoords || staticCoords;
          
          return {
            ...stop,
            coords: enrichedCoords
          };
        });

        // Set route stops to full bus route
        setRouteStops(allStops);

        // Get coordinates for the full route start and end
        const firstStop = allStops[0];
        const lastStop = allStops[allStops.length - 1];

        const startCoords = firstStop?.coords || getStopCoordinates(passengerRoute.city, fullRoute.startStop);
        const endCoords = lastStop?.coords || getStopCoordinates(passengerRoute.city, fullRoute.endStop);

        setStartCoordinates(startCoords);
        setEndCoordinates(endCoords);

        // Re-fetch directions for the full bus route
        if (startCoords && endCoords) {
          (async () => {
            const waypoints = [];
            if (allStops.length > 2) {
              for (let i = 1; i < allStops.length - 1; i++) {
                if (allStops[i].coords && Array.isArray(allStops[i].coords)) {
                  waypoints.push(allStops[i].coords);
                }
              }
            }
            const directions = await getDirections(startCoords, endCoords, waypoints);
            setRouteDirections(directions);
          })();
        }
      }
    }
  };

  const handleBack = () => {
    try {
      console.log('🔙 Change Route button clicked');
      console.log('📍 Clearing passengerRoute from localStorage');
      localStorage.removeItem('passengerRoute');
      console.log('📍 passengerRoute cleared:', localStorage.getItem('passengerRoute'));
      console.log('🚀 Navigating to /passenger...');
      navigate('/passenger');
      console.log('✅ Navigation to /passenger completed');
    } catch (error) {
      console.error('❌ Error in handleBack:', error);
    }
  };

  if (!passengerRoute) {
    return (
      <div className="loading-container">
        <h2 style={{ marginTop: 80 }}>Loading...</h2>
      </div>
    );
  }

  return (
    <div className="bus-list-container">
      <div className="route-info-panel">
        <h1>Available Buses</h1>
        <div className="route-details">
          <p><strong>From:</strong> {passengerRoute.startingPoint}</p>
          <p><strong>To:</strong> {passengerRoute.destination}</p>
          {passengerRoute.preferredRoute && (
            <p><strong>Preferred Route:</strong> {passengerRoute.preferredRoute}</p>
          )}
        </div>
        
        <div className="bus-list">
          {buses.length > 0 ? (
            buses.map(bus => (
              <div 
                key={bus.id} 
                className={`bus-item ${selectedBus?.id === bus.id ? 'selected' : ''}`}
                onClick={() => handleBusSelect(bus)}
              >
                <div className="bus-details">
                  <p><strong>Bus Number:</strong> {bus.vehicleName || bus.vehicleNumber || 'N/A'}</p>
                  <p><strong>Driver Name:</strong> {bus.name}</p>
                  <p><strong>Route:</strong> {bus.route}</p>
                  <p className="arrival-time">
                    <strong>Estimated Arrival:</strong> {bus.estimatedArrival}
                  </p>
                  {bus.estimatedArrivalMinutes > 0 && (
                    <p className="eta-minutes">
                      <strong>ETA:</strong> {bus.estimatedArrivalMinutes} minutes
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-buses" style={{
              backgroundColor: '#ffebee',
              borderLeft: '4px solid #f44336',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#c62828', marginTop: 0 }}>❌ No Buses Found</h3>
              <p style={{ color: '#d32f2f' }}>
                {!routeExists 
                  ? `No routes available between "${passengerRoute.startingPoint}" and "${passengerRoute.destination}". Try selecting different stops.`
                  : 'No buses are currently available for your selected route. Please check back later or try a different route.'}
              </p>
            </div>
          )}
        </div>
        
        <button className="back-button" onClick={handleBack}>
          Change Route
        </button>
      </div>

      <div className="map-container">
        <MapContainer 
          center={mapCenter} 
          zoom={14} 
          style={{ height: '100%', width: '100%' }}
        >
          <MapUpdater center={mapCenter} passengerPosition={passengerPosition} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Route path between start and end destinations - using Google Maps Directions */}
          {routeDirections && routeDirections.path && routeDirections.path.length > 0 && (
            <Polyline 
              positions={routeDirections.path}
              color="#2196F3"
              weight={4}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
            />
          )}
          
          {/* Path connecting all route stops */}
          {routeStops.length > 1 && !routeDirections?.path && (() => {
            const validStops = routeStops.filter(stop => stop.coords && Array.isArray(stop.coords) && stop.coords.length === 2);
            console.log('🛣️ Drawing polyline with', validStops.length, '/', routeStops.length, 'stops:', validStops.map(s => s.name));
            return validStops.length > 1 ? (
              <Polyline 
                positions={validStops.map(stop => stop.coords)}
                color="#4CAF50"
                weight={3}
                opacity={0.7}
                lineCap="round"
                lineJoin="round"
              />
            ) : null;
          })()}
          
          {/* Fallback to straight line if directions not available */}
          {(!routeDirections || !routeDirections.path || routeDirections.error) && startCoordinates && endCoordinates && routeStops.length <= 1 && (
            <>
              <Polyline 
                positions={[startCoordinates, endCoordinates]}
                color="#2196F3"
                weight={3}
                opacity={0.6}
                dashArray="5, 5"
              />
              {console.log('Drawing fallback route from', startCoordinates, 'to', endCoordinates)}
            </>
          )}
          
          {/* Intermediate stops markers */}
          {routeStops.length > 0 && (
            <>
              {console.log('Rendering', routeStops.length, 'stops')}
              {routeStops.map((stop, idx) => {
                // When a bus is selected, skip first and last stops (they have their own markers)
                // When no bus is selected, skip passenger's start and end points
                const isFirstStop = idx === 0;
                const isLastStop = idx === routeStops.length - 1;
                const isPassengerStart = stop.name === passengerRoute?.startingPoint;
                const isPassengerEnd = stop.name === passengerRoute?.destination;
                
                // Skip if invalid coordinates
                if (!stop.coords || !Array.isArray(stop.coords) || stop.coords.length !== 2) {
                  console.warn('Invalid coordinates for stop:', stop.name);
                  return null;
                }
                
                // Skip first/last stops (they have dedicated green/red markers)
                if (isFirstStop || isLastStop) return null;
                
                // If no bus is selected, also skip passenger start and end
                if (!selectedBus && (isPassengerStart || isPassengerEnd)) return null;
                
                return (
                  <Circle 
                    key={`stop-${idx}`}
                    center={stop.coords}
                    radius={25}
                    pathOptions={{ color: '#FF9800', fillColor: '#FF9800', fillOpacity: 0.3 }}
                  >
                    <Popup>
                      <div>
                        <strong>{stop.name}</strong>
                      </div>
                    </Popup>
                  </Circle>
                );
              })}
            </>
          )}
          
          {/* Start Destination Marker */}
          {(() => {
            const isValid = startCoordinates && Array.isArray(startCoordinates) && startCoordinates.length === 2;
            const startLabel = selectedBus && routeStops.length > 0 ? routeStops[0]?.name : passengerRoute?.startingPoint;
            console.log('🟢 START marker:', isValid ? 'VISIBLE' : 'HIDDEN - coords:', startCoordinates);
            return isValid ? (
              <>
                <Marker position={startCoordinates} icon={startIcon}>
                  <Popup>
                    <div>
                      <strong style={{ color: '#4CAF50' }}>📍 {selectedBus ? 'Route Start' : 'Starting Point'}</strong>
                      <br />
                      {startLabel}
                    </div>
                  </Popup>
                </Marker>
                <Circle 
                  center={startCoordinates}
                  radius={50}
                  pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.1 }}
                />
              </>
            ) : null;
          })()}
          
          {/* End Destination Marker */}
          {(() => {
            const isValid = endCoordinates && Array.isArray(endCoordinates) && endCoordinates.length === 2;
            const endLabel = selectedBus && routeStops.length > 0 ? routeStops[routeStops.length - 1]?.name : passengerRoute?.destination;
            console.log('🔴 END marker:', isValid ? 'VISIBLE' : 'HIDDEN - coords:', endCoordinates);
            return isValid ? (
              <>
                <Marker position={endCoordinates} icon={endIcon}>
                  <Popup>
                    <div>
                      <strong style={{ color: '#F44336' }}>📍 {selectedBus ? 'Route End' : 'Destination'}</strong>
                      <br />
                      {endLabel}
                    </div>
                  </Popup>
                </Marker>
                <Circle 
                  center={endCoordinates}
                  radius={50}
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }}
                />
              </>
            ) : null;
          })()}
          
          {/* Bus markers */}
          {buses.map(bus => {
            // Validate bus position coordinates
            if (!bus.position || !Array.isArray(bus.position) || bus.position.length !== 2) {
              console.warn('Invalid bus position for bus:', bus.vehicleName || bus.vehicleNumber);
              return null;
            }
            return (
              <React.Fragment key={bus.id}>
                <Marker position={bus.position} icon={busIcon}>
                  <Popup>
                    <div className="bus-popup">
                      <p><strong>Bus Number:</strong> {bus.vehicleName || bus.vehicleNumber || 'N/A'}</p>
                      <p><strong>Driver Name:</strong> {bus.name}</p>
                      <p><strong>Route:</strong> {bus.route}</p>
                      <p><strong>From:</strong> {bus.from}</p>
                      <p><strong>To:</strong> {bus.to}</p>
                      <p><strong>Estimated Arrival:</strong> {bus.estimatedArrival}</p>
                      {bus.estimatedArrivalMinutes > 0 && (
                        <p><strong>ETA:</strong> {bus.estimatedArrivalMinutes} minutes</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
                
                {/* Bus location accuracy circle */}
                <Circle 
                  center={bus.position}
                  radius={50} // 50 meters radius
                  pathOptions={{ color: '#3388ff', fillColor: '#3388ff', fillOpacity: 0.1 }}
                />
              </React.Fragment>
            );
          })}
          
          {/* Passenger location marker */}
          {(() => {
            const isValid = passengerPosition && Array.isArray(passengerPosition) && passengerPosition.length === 2;
            console.log('👤 PASSENGER marker:', isValid ? 'VISIBLE at ' + passengerPosition : 'HIDDEN - position:', passengerPosition);
            return isValid ? (
              <React.Fragment>
                <Marker position={passengerPosition} icon={passengerIcon}>
                  <Popup>
                    <div className="passenger-popup">
                      <h3>Your Location</h3>
                      <p>Waiting for bus</p>
                      {buses.length > 0 && buses[0].estimatedArrivalMinutes > 0 && (
                        <p><strong>Bus arrives in:</strong> {buses[0].estimatedArrivalMinutes} minutes</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
                
                {/* Passenger location accuracy circle */}
                <Circle 
                  center={passengerPosition}
                  radius={30} // 30 meters radius
                  pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.1 }}
                />
              </React.Fragment>
            ) : null;
          })()}
        </MapContainer>
      </div>
    </div>
  );
};

export default BusList;