import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole, userData, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg, #F4F8F9)',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(99, 178, 198, 0.2)',
          borderTopColor: '#63B2C6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!currentUser || !userRole || !userData) {
    return <Navigate to="/login" replace />;
  }

  if (userRole !== allowedRole) {
    return <Navigate to={`/${userRole}`} replace />;
  }

  return children;
}
