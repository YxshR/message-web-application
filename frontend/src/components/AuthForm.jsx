import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser, clearError } from '../store/slices/authSlice';
import { useFormValidation, VALIDATION_SCHEMAS } from '../utils/validation';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';

const AuthForm = ({ mode = 'login', onModeChange }) => {
  console.log('AuthForm: Rendering with mode:', mode);
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  
  const initialValues = {
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  };
  
  const validationSchema = mode === 'login' 
    ? VALIDATION_SCHEMAS.login 
    : VALIDATION_SCHEMAS.register;
  
  const {
    values: formData,
    errors: validationErrors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset
  } = useFormValidation(initialValues, validationSchema);

  // Clear errors when component mounts or mode changes
  useEffect(() => {
    console.log('AuthForm: useEffect triggered, mode:', mode);
    dispatch(clearError());
    reset();
  }, [dispatch, mode, reset]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    handleChange(name, value);
  };

  const handleInputBlur = (e) => {
    const { name } = e.target;
    handleBlur(name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateAll()) {
      return;
    }
    
    try {
      if (mode === 'login') {
        await dispatch(loginUser({
          username: formData.username,
          password: formData.password
        })).unwrap();
      } else {
        await dispatch(registerUser({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })).unwrap();
      }
    } catch (error) {
      // Error is handled by Redux slice
      console.error('Authentication error:', error);
    }
  };

  const handleRetry = () => {
    dispatch(clearError());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-sm text-gray-600">
              {mode === 'login' 
                ? 'Welcome back! Please sign in to your account.' 
                : 'Join us today! Create your account to get started.'
              }
            </p>
          </div>
          
          {error && (
            <div className="mt-4">
              <ErrorMessage 
                error={error}
                onRetry={handleRetry}
                onDismiss={() => dispatch(clearError())}
              />
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className={`input-field ${validationErrors.username && touched.username ? 'input-error' : ''}`}
                placeholder="Enter your username"
                disabled={isLoading}
                autoComplete="username"
              />
              {validationErrors.username && touched.username && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.username}
                </p>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className={`input-field ${validationErrors.email && touched.email ? 'input-error' : ''}`}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                />
                {validationErrors.email && touched.email && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {validationErrors.email}
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className={`input-field ${validationErrors.password && touched.password ? 'input-error' : ''}`}
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {validationErrors.password && touched.password && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.password}
                </p>
              )}
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className={`input-field ${validationErrors.confirmPassword && touched.confirmPassword ? 'input-error' : ''}`}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                {validationErrors.confirmPassword && touched.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {validationErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner 
                  size="sm" 
                  color="white" 
                  text={mode === 'login' ? 'Signing In...' : 'Creating Account...'}
                />
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
                disabled={isLoading}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;