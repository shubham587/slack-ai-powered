import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  VStack,
  Text,
  Button,
  HStack,
  useToast,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import {
  fetchPendingInvitations,
  acceptInvitation,
  rejectInvitation,
  selectPendingInvitations,
  selectInvitationsLoading,
  selectInvitationsError,
  addInvitation,
} from '../../store/slices/invitationsSlice';
import { getSocket } from '../../socket';

const PendingInvitations = () => {
  const dispatch = useDispatch();
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState({});
  const currentUserId = localStorage.getItem('userId');
  
  const allInvitations = useSelector(selectPendingInvitations) || [];
  const pendingInvitations = allInvitations.filter(inv => inv.invitee_id === currentUserId);
  const isLoading = useSelector(selectInvitationsLoading);
  const error = useSelector(selectInvitationsError);

  useEffect(() => {
    // Fetch pending invitations when component mounts
    dispatch(fetchPendingInvitations());

    // Get socket instance
    const socket = getSocket();
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    // Set up socket event listeners
    const handleNewInvitation = (data) => {
      console.log('Received new invitation:', data);
      // Only add invitation if current user is the invitee
      if (data.invitee_id === currentUserId) {
        dispatch(addInvitation(data));
        toast({
          title: 'New Channel Invitation',
          description: `${data.inviter_username} invited you to join #${data.channel_name}`,
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    socket.on('new_invitation', handleNewInvitation);

    // Cleanup
    return () => {
      socket.off('new_invitation', handleNewInvitation);
    };
  }, [dispatch, toast, currentUserId]);

  const handleAccept = async (invitationId) => {
    try {
      setActionLoading(prev => ({ ...prev, [invitationId]: true }));
      await dispatch(acceptInvitation(invitationId)).unwrap();
      toast({
        title: 'Invitation Accepted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [invitationId]: false }));
    }
  };

  const handleReject = async (invitationId) => {
    try {
      setActionLoading(prev => ({ ...prev, [invitationId]: true }));
      await dispatch(rejectInvitation(invitationId)).unwrap();
      toast({
        title: 'Invitation Rejected',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject invitation',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [invitationId]: false }));
    }
  };

  if (isLoading) {
    return (
      <Box p={4} bg="gray.800" borderRadius="md" shadow="md">
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} bg="gray.800" borderRadius="md" shadow="md">
        <Text color="red.500">Error: {error}</Text>
      </Box>
    );
  }

  if (!pendingInvitations.length) {
    return null;
  }

  return (
    <Box p={4} bg="gray.800" borderRadius="md" shadow="md" maxW="sm">
      <VStack spacing={4} align="stretch">
        <Text color="white" fontWeight="bold" fontSize="lg">
          Pending Invitations
          <Badge ml={2} colorScheme="blue">
            {pendingInvitations.length}
          </Badge>
        </Text>
        {pendingInvitations.map((invitation) => (
          <Box
            key={invitation.id}
            p={4}
            bg="gray.700"
            borderRadius="md"
            shadow="sm"
          >
            <VStack align="stretch" spacing={3}>
              <Text color="white">
                <Text as="span" fontWeight="bold">
                  {invitation.inviter_username}
                </Text>{' '}
                invited you to join{' '}
                <Text as="span" fontWeight="bold">
                  #{invitation.channel_name}
                </Text>
              </Text>
              <HStack spacing={2} justify="flex-end">
                <Button
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  isLoading={actionLoading[invitation.id]}
                  onClick={() => handleReject(invitation.id)}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  colorScheme="green"
                  isLoading={actionLoading[invitation.id]}
                  onClick={() => handleAccept(invitation.id)}
                >
                  Accept
                </Button>
              </HStack>
            </VStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

export default PendingInvitations; 