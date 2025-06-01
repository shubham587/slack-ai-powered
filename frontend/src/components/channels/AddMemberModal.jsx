import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  VStack,
  useToast,
  List,
  ListItem,
  Avatar,
  Text,
  Box,
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { addChannelMember } from '../../store/slices/channelsSlice';
import { useDebounce } from '../../hooks/useDebounce';
import axios from 'axios';

const AddMemberModal = ({ isOpen, onClose, channelId }) => {
  const dispatch = useDispatch();
  const toast = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Search users when debounced search term changes
  React.useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedSearchTerm) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const response = await axios.get(`/api/users/search?q=${debouncedSearchTerm}`);
        setSearchResults(response.data.filter(user => 
          !selectedUsers.find(selected => selected.id === user.id)
        ));
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };
    
    searchUsers();
  }, [debouncedSearchTerm, selectedUsers]);
  
  const handleSelectUser = (user) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchResults(prev => prev.filter(u => u.id !== user.id));
    setSearchTerm('');
  };
  
  const handleRemoveUser = (user) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
  };
  
  const handleSubmit = async () => {
    if (!selectedUsers.length) {
      toast({
        title: 'No users selected',
        description: 'Please select at least one user to add',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // Add each selected user to the channel
      await Promise.all(
        selectedUsers.map(user =>
          dispatch(addChannelMember({
            channelId,
            userId: user.id,
          })).unwrap()
        )
      );
      
      toast({
        title: 'Members added',
        description: `Successfully added ${selectedUsers.length} member(s) to the channel`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onClose();
      setSelectedUsers([]);
      setSearchTerm('');
    } catch (error) {
      toast({
        title: 'Error adding members',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Add Members</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4}>
            <Box w="100%">
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                _placeholder={{ color: 'gray.500' }}
              />
            </Box>
            
            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  Selected Users ({selectedUsers.length})
                </Text>
                <List spacing={2}>
                  {selectedUsers.map((user) => (
                    <ListItem
                      key={user.id}
                      p={2}
                      borderRadius="md"
                      bg="gray.700"
                    >
                      <Flex align="center" justify="space-between">
                        <Flex align="center">
                          <Avatar
                            size="sm"
                            name={user.username}
                            src={user.avatar_url}
                            mr={2}
                          />
                          <Text>{user.username}</Text>
                        </Flex>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveUser(user)}
                        >
                          Remove
                        </Button>
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {/* Search Results */}
            {isSearching ? (
              <Flex justify="center" w="100%" py={4}>
                <Spinner />
              </Flex>
            ) : searchResults.length > 0 && (
              <Box w="100%">
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  Search Results
                </Text>
                <List spacing={2}>
                  {searchResults.map((user) => (
                    <ListItem
                      key={user.id}
                      p={2}
                      borderRadius="md"
                      bg="gray.700"
                      cursor="pointer"
                      onClick={() => handleSelectUser(user)}
                      _hover={{ bg: 'gray.600' }}
                    >
                      <Flex align="center">
                        <Avatar
                          size="sm"
                          name={user.username}
                          src={user.avatar_url}
                          mr={2}
                        />
                        <Text>{user.username}</Text>
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isLoading}
            isDisabled={!selectedUsers.length}
          >
            Add Members
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddMemberModal; 