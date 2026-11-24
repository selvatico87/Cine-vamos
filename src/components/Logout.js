import React from 'react';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../context/FirebaseContext';

const Logout = () => {
  const navigate = useNavigate();
  const { logout } = useFirebase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Button onClick={handleLogout} variant="contained" color="secondary">
      Cerrar sesión
    </Button>
  );
};

export default Logout;
