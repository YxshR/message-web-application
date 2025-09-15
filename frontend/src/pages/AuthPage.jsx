import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SimpleAuthForm from '../components/SimpleAuthForm';

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine mode based on current path
  const [mode, setMode] = useState(() => {
    return location.pathname === '/register' ? 'register' : 'login';
  });

  // Update mode when location changes
  useEffect(() => {
    const newMode = location.pathname === '/register' ? 'register' : 'login';
    console.log('AuthPage: Location changed to', location.pathname, 'Mode:', newMode);
    setMode(newMode);
  }, [location.pathname]);

  const handleModeChange = (newMode) => {
    console.log('AuthPage: Mode change requested:', newMode);
    if (newMode === 'register') {
      navigate('/register');
    } else {
      navigate('/login');
    }
  };

  console.log('AuthPage: Rendering with mode:', mode, 'pathname:', location.pathname);

  return (
    <div key={location.pathname}>
      <SimpleAuthForm 
        mode={mode} 
        onModeChange={handleModeChange} 
      />
    </div>
  );
};

export default AuthPage;