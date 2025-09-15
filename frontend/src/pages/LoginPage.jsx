import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthForm from '../components/AuthForm';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleModeChange = (mode) => {
    if (mode === 'register') {
      navigate('/register');
    }
  };

  return <AuthForm key={`login-${location.pathname}`} mode="login" onModeChange={handleModeChange} />;
};

export default LoginPage;