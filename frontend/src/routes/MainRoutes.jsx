import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { selectIsAuthenticated, selectIsLoading, checkAuth } from '../store/slices/authSlice';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Chat from '../pages/Chat';
import AITester from '../components/ai/AITester';
import LoadingScreen from '../components/common/LoadingScreen';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};

const MainRoutes = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);

  useEffect(() => {
    dispatch(checkAuth()).catch(() => {
      // Silently handle the error as it's already handled in the reducer
    });
  }, [dispatch]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Auth Routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/" /> : <Register />} 
      />

      {/* Protected Routes */}
      <Route
        path="/ai-test"
        element={
          <ProtectedRoute>
            <AITester />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      
      {/* Catch-all route - redirect to AI test for testing */}
      <Route path="*" element={<Navigate to="/ai-test" />} />
    </Routes>
  );
};

export default MainRoutes; 