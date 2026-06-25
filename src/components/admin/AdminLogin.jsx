import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeSampleAdmins, authenticateAdmin } from '../../services/AdminService';
import './AdminLogin.css';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialChange = (e) => {
    const { name, value } = e.target;
    setCredentials({
      ...credentials,
      [name]: value
    });
    setError(''); // Clear error when user types
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Initialize sample admins if they don't exist (for demo purposes)
      await initializeSampleAdmins();
      
      // Authenticate admin using the service
      const adminData = await authenticateAdmin(credentials.username, credentials.password);
      
      // Authentication successful
      // Store admin info in localStorage
      localStorage.setItem('adminInfo', JSON.stringify(adminData));
      
      // Navigate to admin panel
      navigate('/admin/panel');
    } catch (error) {
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminInfo');
    navigate('/');
  };

  return (
    <div className="admin-login-container">
      <div style={{ position: 'absolute', top: 20, left: 30, fontWeight: 'bold', fontSize: '2rem', color: '#fff', letterSpacing: '2px', zIndex: 100 }}>
        Transit Tracker
      </div>
      <button 
        onClick={() => navigate('/')}
        className="home-button"
      >
        Home
      </button>
      <h1 style={{ marginTop: 80 }}>Admin Login</h1>
      
      <div className="admin-form-container">
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
              placeholder="Enter your admin username"
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
          <h3>Demo Admin Credentials:</h3>
          <p><strong>Username:</strong> admin001 | <strong>Password:</strong> admin@123</p>
          <p><strong>Company:</strong> City Transportation Ltd (Bangalore routes)</p>
          <hr />
          <p><strong>Username:</strong> admin002 | <strong>Password:</strong> admin@456</p>
          <p><strong>Company:</strong> Coastal Bus Services (Mangalore routes)</p>
          <hr />
          <p><strong>Username:</strong> admin003 | <strong>Password:</strong> admin@789</p>
          <p><strong>Company:</strong> National Transit Corp (All cities)</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
