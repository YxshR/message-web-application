import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from './store/slices/authSlice';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import Contacts from './pages/Contacts';
import useSocket from './hooks/useSocket';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatus from './components/NetworkStatus';


function App() {
  const dispatch = useDispatch();
  const { token, isAuthenticated } = useSelector((state) => state.auth);
  
  console.log('App render - isAuthenticated:', isAuthenticated, 'token:', token ? 'present' : 'null');
  
  // Initialize socket connection
  useSocket();

  useEffect(() => {
    console.log('App useEffect - token:', token, 'isAuthenticated:', isAuthenticated);
    // Check if user is authenticated on app load
    if (token && !isAuthenticated) {
      console.log('Dispatching getCurrentUser');
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, isAuthenticated]);

  return (
    <ErrorBoundary>
      <Router>
        <div className="h-full">
          <NetworkStatus />
          <Routes>
            {/* Public routes */}
            <Route 
              path="/login" 
              element={
                isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
              } 
            />
            <Route 
              path="/register" 
              element={
                isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
              } 
            />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/chat" replace />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
