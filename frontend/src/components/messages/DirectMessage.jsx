import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  VStack,
  Avatar,
  Text,
  Box,
  Flex,
  List,
  ListItem,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { useDebounce } from 'use-debounce';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';

const DirectMessage = ({ isOpen, onClose, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/messages/recent-chats`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setRecentChats(response.data);
    } catch (error) {
      console.error('Error loading recent chats:', error);
      toast({
        title: 'Error loading recent chats',
        description: error.response?.data?.message || 'Failed to load recent conversations',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const searchUsers = async () => {
    if (!debouncedSearchTerm.trim()) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/users/search?q=${encodeURIComponent(debouncedSearchTerm)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Filter out current user from results
      const filteredResults = response.data.filter(user => user.id !== currentUser?.id);
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: 'Error searching users',
        description: error.response?.data?.message || 'Failed to search users',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    onSelectUser(user);
    onClose();
    setSearchTerm('');
    setSearchResults([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Direct Message</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <Box position="relative">
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                pl={10}
                bg="gray.700"
                border="1px"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
              />
              <SearchIcon position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.400" />
            </Box>

            {searchResults.length > 0 && (
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Search Results</Text>
                <List spacing={2}>
                  {searchResults.map((user) => (
                    <ListItem
                      key={user.id}
                      p={2}
                      borderRadius="md"
                      bg="gray.700"
                      _hover={{ bg: 'gray.600', cursor: 'pointer' }}
                      onClick={() => handleUserSelect(user)}
                    >
                      <Flex align="center" gap={3}>
                        <Avatar size="sm" name={user.username} src={user.avatar_url} />
                        <Box>
                          <Text fontWeight="medium">{user.username}</Text>
                          {user.display_name && (
                            <Text fontSize="sm" color="gray.400">{user.display_name}</Text>
                          )}
                        </Box>
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {recentChats.length > 0 && (
              <>
                <Divider borderColor="gray.600" />
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Recent Conversations</Text>
                  <List spacing={2}>
                    {recentChats.map((chat) => (
                      <ListItem
                        key={chat.user.id}
                        p={2}
                        borderRadius="md"
                        bg="gray.700"
                        _hover={{ bg: 'gray.600', cursor: 'pointer' }}
                        onClick={() => handleUserSelect(chat.user)}
                      >
                        <Flex align="center" gap={3}>
                          <Avatar size="sm" name={chat.user.username} src={chat.user.avatar_url} />
                          <Box>
                            <Text fontWeight="medium">{chat.user.username}</Text>
                            <Text fontSize="xs" color="gray.400">
                              {chat.last_message?.content?.substring(0, 30)}
                              {chat.last_message?.content?.length > 30 ? '...' : ''}
                            </Text>
                          </Box>
                        </Flex>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default DirectMessage; 