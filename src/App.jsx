import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Direct static imports to completely prevent chunk load / dynamic import errors on deployments
import AdminDashboard from './pages/AdminDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import StaffDashboard from './pages/StaffDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Migration from './pages/Migration';
import ParentDashboard from './pages/ParentDashboard';
import SchoolExcellenceDashboard from './pages/SchoolExcellenceDashboard';

import InstallPwaBanner from './components/InstallPwaBanner';
import FileViewer from './pages/FileViewer';
import MonthlyMentorReports from './pages/MonthlyMentorReports';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <Router>
            <InstallPwaBanner />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/file-viewer" element={<FileViewer />} />
              <Route path="/admin/*" element={
                <ProtectedRoute allowedRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/staff/*" element={
                <ProtectedRoute allowedRole="staff">
                  <StaffDashboard />
                </ProtectedRoute>
              } />
              <Route path="/supervisor/*" element={
                <ProtectedRoute allowedRole="supervisor">
                  <SupervisorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/superadmin/*" element={
                <ProtectedRoute allowedRole="superadmin">
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/migrate" element={<Migration />} />
              <Route path="/teacher/*" element={
                <ProtectedRoute allowedRole="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              } />
              <Route path="/student/*" element={
                <ProtectedRoute allowedRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              } />
              {/* Standalone Direct Public View for Monthly Mentor Reports (Zero login barrier for parents via WhatsApp/SMS links) */}
              <Route path="/parent/monthly-reports" element={<MonthlyMentorReports role="public" />} />
              <Route path="/public/monthly-reports" element={<MonthlyMentorReports role="public" />} />
              <Route path="/public-monthly-report" element={<MonthlyMentorReports role="public" />} />

              <Route path="/parent/*" element={
                <ProtectedRoute allowedRole="parent">
                  <ParentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/school-excellence" element={<SchoolExcellenceDashboard />} />
            </Routes>
          </Router>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
