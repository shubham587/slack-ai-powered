import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  VStack,
  Text,
  Button,
  HStack,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import {
  fetchPendingInvitations,
  acceptInvitation,
  rejectInvitation,
  selectPendingInvitations,
  selectInvitationsLoading,
  selectInvitationsError,
} from '../../store/slices/invitationsSlice';
import { getSocket } from '../../socket';

const PendingInvitations = () => {
  const dispatch = useDispatch();
  const toast = useToast();
  const allInvitations = useSelector(selectPendingInvitations);
  const isLoading = useSelector(selectInvitationsLoading);
  const error = useSelector(selectInvitationsError);
  const currentUserId = localStorage.getItem('user_id');

  // Filter invitations for the current user
  const invitations = allInvitations.filter(inv => inv.invitee_id === currentUserId);

  // Memoize the handlers to prevent unnecessary re-renders
  const handleAccept = useCallback(async (invitationId) => {
    try {
      await dispatch(acceptInvitation(invitationId)).unwrap();
      toast({
        title: 'Invitation accepted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error accepting invitation',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [dispatch, toast]);

  const handleReject = useCallback(async (invitationId) => {
    try {
      await dispatch(rejectInvitation(invitationId)).unwrap();
      toast({
        title: 'Invitation rejected',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error rejecting invitation',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [dispatch, toast]);

  useEffect(() => {
    // Fetch pending invitations when component mounts
    dispatch(fetchPendingInvitations());

    // Set up socket event listeners
    const socket = getSocket();
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    // Join user's personal room
    if (currentUserId) {
      socket.emit('join_user_room', { user_id: currentUserId });
    }

    // Clean up function
    return () => {
      // No need to remove listeners as they are handled globally in socket.js
    };
  }, [dispatch, currentUserId]);

  if (isLoading) {
    return (
      <Box textAlign="center" py={4}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} bg="red.100" color="red.900" borderRadius="md">
        <Text>Error: {error}</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {invitations.map((invitation) => (
        <Box
          key={invitation.id}
          p={4}
          borderWidth={1}
          borderRadius="md"
          position="relative"
        >
          <Text fontWeight="bold" mb={2}>
            Channel: #{invitation.channel_name}
          </Text>
          <Text fontSize="sm" color="gray.500" mb={4}>
            Invited by: {invitation.inviter_username}
          </Text>
          <HStack spacing={4} justify="flex-end">
            <Button
              colorScheme="red"
              variant="outline"
              size="sm"
              onClick={() => handleReject(invitation.id)}
            >
              Reject
            </Button>
            <Button
              colorScheme="green"
              size="sm"
              onClick={() => handleAccept(invitation.id)}
            >
              Accept
            </Button>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
};

export default PendingInvitations; 