import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthForm from '../components/AuthForm';

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleModeChange = (mode) => {
    if (mode === 'login') {
      navigate('/login');
    }
  };

  return <AuthForm key={`register-${location.pathname}`} mode="register" onModeChange={handleModeChange} />;
};

export default RegisterPage;