import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleUserTypeSelection = (userType) => {
    if (userType === 'driver') {
      navigate('/driver');
    } else {
      navigate('/passenger');
    }
  };

  return (
    <div className="landing-container">
      <div style={{ position: 'absolute', top: 20, left: 30, fontWeight: 'bold', fontSize: '2rem', color: 'white', letterSpacing: '2px', zIndex: 100 }}>
        Transit Tracker
      </div>
      <h1 style={{ marginTop: 80 }}>Bus Tracking System</h1>
      <div className="user-selection">
        <h2>Choose your role:</h2>
        <div className="button-container">
          <button 
            className="user-type-button admin-button"
            onClick={() => navigate('/admin/login')}
          >
            Admin
          </button>
          <button 
            className="user-type-button driver-button"
            onClick={() => handleUserTypeSelection('driver')}
          >
            Driver
          </button>
          <button 
            className="user-type-button passenger-button"
            onClick={() => handleUserTypeSelection('passenger')}
          >
            Passenger
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;