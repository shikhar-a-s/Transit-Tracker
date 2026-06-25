/**
 * DirectionsService.js - OSRM (Open Source Routing Machine) Integration
 * Handles real driving route calculations, distance, and travel time
 * FREE - No API key required!
 */

// OSRM public server (or use your own self-hosted instance)
const OSRM_SERVER = process.env.REACT_APP_OSRM_BASE_URL;

/**
 * Fetch route directions from OSRM (Open Source Routing Machine)
 * @param {Array} origin - [latitude, longitude] start point
 * @param {Array} destination - [latitude, longitude] end point
 * @param {Array} waypoints - Optional array of intermediate [lat, lng] points to route through
 * @returns {Promise} - { distance, duration, path: [[lat,lng], ...] }
 */
export const getDirections = async (origin, destination, waypoints = []) => {
  try {
    // OSRM expects coordinates as [longitude, latitude]
    // Build coordinate string: start; waypoint1; waypoint2; ...; end
    let coordParts = [
      `${origin[1]},${origin[0]}`  // Start
    ];
    
    // Add waypoints (filter out invalid coordinates)
    if (Array.isArray(waypoints) && waypoints.length > 0) {
      waypoints.forEach(wp => {
        if (wp && Array.isArray(wp) && wp.length === 2) {
          coordParts.push(`${wp[1]},${wp[0]}`);  // [lng, lat]
        }
      });
    }
    
    coordParts.push(`${destination[1]},${destination[0]}`);  // End
    
    const coordString = coordParts.join(';');
    
    const response = await fetch(
      `${OSRM_SERVER}/route/v1/driving/${coordString}?overview=full&geometries=geojson`
    );

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok') {
      console.warn(`OSRM status: ${data.code}`);
      return {
        distance: 'N/A',
        duration: 'N/A',
        path: [origin, destination],
        error: data.code
      };
    }

    const route = data.routes[0];
    
    // Convert GeoJSON coordinates to [lat, lng] format
    const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    return {
      distance: formatDistance(route.distance),
      distanceMeters: route.distance,
      duration: formatDuration(route.duration),
      durationSeconds: route.duration,
      path: path,
      error: null
    };
  } catch (error) {
    console.error('Error fetching directions from OSRM:', error);
    return {
      distance: 'Error',
      duration: 'Error',
      path: [origin, destination],
      error: error.message
    };
  }
};

/**
 * Format duration in seconds to readable string
 * @param {Number} seconds - Duration in seconds
 * @returns {String} - Formatted time string (e.g., "25 mins", "2 hours")
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Format distance in meters to readable string
 * @param {Number} meters - Distance in meters
 * @returns {String} - Formatted distance string (e.g., "15.6 km", "500 m")
 */
export const formatDistance = (meters) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};
