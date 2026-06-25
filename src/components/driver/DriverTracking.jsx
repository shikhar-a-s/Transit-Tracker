import React, { useState, useEffect } from 'react';
import { ref, set, remove } from 'firebase/database';
import { db } from '../../firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './DriverTracking.css';

// Custom bus icon for driver
const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Fix for Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const DriverTracking = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get driver info from localStorage
    const storedDriverInfo = localStorage.getItem('driverInfo');
    if (!storedDriverInfo) {
      navigate('/driver');
      return;
    }
    
    setDriverInfo(JSON.parse(storedDriverInfo));
    
    // Get initial position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPosition([
            position.coords.latitude,
            position.coords.longitude
          ]);
          setError(null);
        },
        (err) => {
          setError(`Error: ${err.message}`);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser');
    }
  }, [navigate]);

  useEffect(() => {
    let watchId;

    if (navigator.geolocation && driverInfo?.vehicleName) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setPosition(newPosition);
          
          // Send driver location to Firebase (automatically while logged in)
          // Double-check that driverInfo still exists (user hasn't logged out)
          const currentDriverInfo = localStorage.getItem('driverInfo');
          if (currentDriverInfo) {
            const locationData = {
              ...driverInfo,
              position: newPosition,
              timestamp: new Date().toISOString()
            };
            set(ref(db, `buses/${driverInfo.vehicleName}`), locationData);
          }
        },
        (err) => {
          setError(`Error: ${err.message}`);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [driverInfo]);

  const handleLogout = () => {
    // Remove bus from Firebase first
    if (driverInfo?.vehicleName) {
      remove(ref(db, `buses/${driverInfo.vehicleName}`))
        .then(() => {
          // Only after successful removal, clear localStorage and navigate
          localStorage.removeItem('driverInfo');
          navigate('/');
        })
        .catch((error) => {
          console.error('Error removing bus from Firebase:', error);
          // Even if removal fails, clear and navigate
          localStorage.removeItem('driverInfo');
          navigate('/');
        });
    } else {
      localStorage.removeItem('driverInfo');
      navigate('/');
    }
  };

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/driver')}>Go Back</button>
      </div>
    );
  }

  if (!position || !driverInfo) {
    return (
      <div className="loading-container">
        <h2>Loading...</h2>
        <p>Please allow location access to continue</p>
      </div>
    );
  }

  return (
    <div className="driver-tracking-container">
      <div className="driver-info-panel">
        <h1>Driver Tracking</h1>
        <div className="driver-details">
          <p><strong>Driver:</strong> {driverInfo.name || driverInfo.driverName}</p>
          <p><strong>Vehicle:</strong> {driverInfo.vehicleName || driverInfo.vehicleNumber}</p>
          <p><strong>Route:</strong> {driverInfo.route}</p>
          <p><strong>From:</strong> {driverInfo.startingPoint}</p>
          <p><strong>To:</strong> {driverInfo.destination}</p>
        </div>
        <div className="action-buttons">
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="map-container">
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Accuracy circle around the driver's position */}
          <Circle 
            center={position}
            radius={50} // 50 meters radius
            pathOptions={{ color: '#3388ff', fillColor: '#3388ff', fillOpacity: 0.2 }}
          />
          {/* Driver's position marker with custom icon */}
          <Marker position={position} icon={busIcon}>
            <Popup>
              <div className="driver-popup">
                <h3>{driverInfo.vehicleName}</h3>
                <p><strong>Route:</strong> {driverInfo.route}</p>
                <p><strong>From:</strong> {driverInfo.startingPoint}</p>
                <p><strong>To:</strong> {driverInfo.destination}</p>
                <p><strong>Current Location:</strong> [{position[0].toFixed(5)}, {position[1].toFixed(5)}]</p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default DriverTracking;