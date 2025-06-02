import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, Tooltip } from '@chakra-ui/react';
import { FiLogOut } from 'react-icons/fi';
import { logout } from '../../store/slices/authSlice';

const LogoutButton = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <Tooltip label="Logout" placement="right">
      <Button
        width="full"
        size="md"
        variant="ghost"
        colorScheme="red"
        onClick={handleLogout}
        color="red.300"
        _hover={{ bg: 'rgba(254, 178, 178, 0.12)', color: 'red.200' }}
        leftIcon={<Icon as={FiLogOut} boxSize="5" />}
        justifyContent="flex-start"
        borderRadius="md"
      >
        Logout
      </Button>
    </Tooltip>
  );
};

export default LogoutButton; 