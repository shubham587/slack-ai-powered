import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { useDebounce } from 'use-debounce';
import axios from 'axios';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  VStack,
  List,
  ListItem,
  Avatar,
  Text,
  Box,
  Flex,
  Divider,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';

const DirectMessage = ({ isOpen, onClose, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const currentUser = useSelector(selectUser);
  const toast = useToast();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  useEffect(() => {
    if (isOpen) {
      loadRecentChats();
    }
  }, [isOpen]);

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  const loadRecentChats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get(`${API_URL}/api/messages/recent-chats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Recent chats response:', response.data);
      setRecentChats(response.data || []);
    } catch (error) {
      console.error('Error loading recent chats:', error);
      setError('Failed to load recent chats');
      toast({
        title: 'Error',
        description: 'Failed to load recent chats',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get(`${API_URL}/api/users/search?q=${encodeURIComponent(debouncedSearchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setSearchResults(response.data.filter(user => user.id !== currentUser.id));
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users');
      toast({
        title: 'Error',
        description: 'Failed to search users',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = async (selectedUser) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.post(
        `${API_URL}/api/channels/dm/${selectedUser.id}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('DM channel created:', response.data);
      onSelectUser(selectedUser, response.data.id);
      onClose();
    } catch (error) {
      console.error('Error creating DM channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to create direct message channel',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Direct Messages</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            mb={4}
          />
          
          {isLoading && (
            <Flex justify="center" my={4}>
              <Spinner />
            </Flex>
          )}

          {error && (
            <Alert status="error" mb={4}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          <VStack spacing={4} align="stretch">
            {searchTerm ? (
              <List spacing={3}>
                {searchResults.map((user) => (
                  <ListItem
                    key={user.id}
                    p={2}
                    cursor="pointer"
                    _hover={{ bg: 'gray.100' }}
                    onClick={() => handleUserSelect(user)}
                  >
                    <Flex align="center">
                      <Avatar size="sm" name={user.username} src={user.avatar_url} />
                      <Box ml={3}>
                        <Text fontWeight="bold">{user.display_name || user.username}</Text>
                        <Text fontSize="sm" color="gray.500">@{user.username}</Text>
                      </Box>
                    </Flex>
                  </ListItem>
                ))}
              </List>
            ) : (
              <>
                <Text fontWeight="bold" mb={2}>Recent Chats</Text>
                <List spacing={3}>
                  {recentChats.map((chat) => (
                    <ListItem
                      key={chat.channel_id}
                      p={2}
                      cursor="pointer"
                      _hover={{ bg: 'gray.100' }}
                      onClick={() => handleUserSelect(chat.user)}
                    >
                      <Flex align="center">
                        <Avatar size="sm" name={chat.user.username} src={chat.user.avatar_url} />
                        <Box ml={3}>
                          <Text fontWeight="bold">{chat.user.display_name || chat.user.username}</Text>
                          <Text fontSize="sm" color="gray.500">
                            {chat.last_message
                              ? chat.last_message.length > 50
                                ? `${chat.last_message.substring(0, 50)}...`
                                : chat.last_message
                              : 'No messages yet'}
                          </Text>
                        </Box>
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default DirectMessage; 