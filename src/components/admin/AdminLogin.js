import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  ref,
  get,
} from "firebase/database";

import { auth, db } from "../../firebase";

const AdminLogin = () => {
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentialChange = (e) => {
    const { name, value } = e.target;

    setCredentials({
      ...credentials,
      [name]: value,
    });

    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.username,
        credentials.password
      );

      const user = userCredential.user;

      // Check if the authenticated user is an admin
      const adminRef = ref(db, `adminCredentials/${user.uid}`);
      const snapshot = await get(adminRef);

      if (!snapshot.exists()) {
        await signOut(auth);
        setError("You are not authorized as an admin.");
        return;
      }

      const adminData = snapshot.val();

      // Store admin information
      localStorage.setItem(
        "adminInfo",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          role: adminData.role,
          city: adminData.city,
          company: adminData.company,
        })
      );

      navigate("/admin/panel");

    } catch (error) {
      setError(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("adminInfo");
    navigate("/");
  };

  return (
    <div className="admin-login-container">
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 30,
          fontWeight: "bold",
          fontSize: "2rem",
          color: "#fff",
          letterSpacing: "2px",
          zIndex: 100,
        }}
      >
        Transit Tracker
      </div>

      <button
        onClick={() => navigate("/")}
        className="home-button"
      >
        Home
      </button>

      <h1 style={{ marginTop: 80 }}>Admin Login</h1>

      <div className="admin-form-container">
        <form onSubmit={handleLogin}>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Email:</label>

            <input
              type="email"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleCredentialChange}
              required
              placeholder="Enter your admin email"
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

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

        </form>

        <div className="demo-credentials">
          <h3>Admin Accounts</h3>

          <p>
            <strong>Bangalore:</strong><br />
            bangalore.admin@transittracker.com
          </p>

          <hr />

          <p>
            <strong>Mangalore:</strong><br />
            mangalore.admin@transittracker.com
          </p>

          <hr />

          <p>
            <strong>Super Admin:</strong><br />
            superadmin@transittracker.com
          </p>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;