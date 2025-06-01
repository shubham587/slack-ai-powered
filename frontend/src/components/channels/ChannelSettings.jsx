import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  Textarea,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
  Text,
  List,
  ListItem,
  IconButton,
  Flex,
  Avatar,
  useDisclosure,
  Spinner,
} from '@chakra-ui/react';
import { DeleteIcon, AddIcon } from '@chakra-ui/icons';
import {
  updateChannel,
  addChannelMember,
  removeChannelMember,
  selectChannelById,
} from '../../store/slices/channelsSlice';
import AddMemberModal from './AddMemberModal';
import { createInvitation } from '../../store/slices/invitationsSlice';
import axios from 'axios';
import { useDebounce } from '../../hooks/useDebounce';

const ChannelSettings = ({ isOpen, onClose, channelId }) => {
  const dispatch = useDispatch();
  const toast = useToast();
  const channel = useSelector(state => selectChannelById(state, channelId));
  const {
    isOpen: isAddMemberOpen,
    onOpen: onAddMemberOpen,
    onClose: onAddMemberClose,
  } = useDisclosure();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_private: false,
    topic: '',
  });
  
  // Update form data when channel changes
  useEffect(() => {
    if (channel) {
      setFormData({
        name: channel.name || '',
        description: channel.description || '',
        is_private: channel.is_private || false,
        topic: channel.topic || '',
      });
    }
  }, [channel]);

  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Use our custom debounce hook
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Update search effect to use debouncedSearchTerm
  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedSearchTerm) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/users/search?q=${debouncedSearchTerm}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        // Filter out users who are already members
        const users = Array.isArray(response.data) ? response.data : [];
        if (channel && channel.members) {
          setSearchResults(users.filter(user => 
            !channel.members.find(member => member.id === user.id)
          ));
        } else {
          setSearchResults(users);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        toast({
          title: 'Error searching users',
          description: error.response?.data?.error || 'Failed to search users',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchUsers();
  }, [debouncedSearchTerm, channel, toast]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'is_private' ? checked : value,
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (!formData.name.trim()) {
        throw new Error('Channel name is required');
      }
      
      await dispatch(updateChannel({
        channelId,
        data: formData,
      })).unwrap();
      
      toast({
        title: 'Channel updated',
        description: `#${formData.name} has been updated successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: 'Error updating channel',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRemoveMember = async (userId) => {
    try {
      await dispatch(removeChannelMember({
        channelId,
        userId,
      })).unwrap();
      
      toast({
        title: 'Member removed',
        description: 'Member has been removed from the channel',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error removing member',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleInviteUser = async (userId) => {
    try {
      await dispatch(createInvitation({
        channelId,
        userId
      })).unwrap();

      toast({
        title: 'Invitation sent',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      toast({
        title: 'Error sending invitation',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  if (!channel) return null;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Channel Settings - #{channel.name}</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <Tabs variant="line" colorScheme="blue" isFitted>
            <TabList mb={4}>
              <Tab _selected={{ color: 'blue.400', borderColor: 'blue.400' }}>General</Tab>
              <Tab _selected={{ color: 'blue.400', borderColor: 'blue.400' }}>Members</Tab>
              <Tab _selected={{ color: 'blue.400', borderColor: 'blue.400' }}>Invite</Tab>
            </TabList>
            
            <TabPanels>
              {/* General Settings */}
              <TabPanel>
                <form id="channel-settings-form" onSubmit={handleSubmit}>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>Channel Name</FormLabel>
                      <Input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. project-updates"
                        _placeholder={{ color: 'gray.500' }}
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Description</FormLabel>
                      <Textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="What's this channel about?"
                        _placeholder={{ color: 'gray.500' }}
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Topic</FormLabel>
                      <Input
                        name="topic"
                        value={formData.topic}
                        onChange={handleChange}
                        placeholder="Set a topic for this channel"
                        _placeholder={{ color: 'gray.500' }}
                      />
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">
                        Private Channel
                      </FormLabel>
                      <Switch
                        name="is_private"
                        isChecked={formData.is_private}
                        onChange={handleChange}
                      />
                    </FormControl>
                  </VStack>
                </form>
              </TabPanel>
              
              {/* Members Management */}
              <TabPanel>
                <Box mb={4}>
                  <Flex justify="space-between" align="center">
                    <Text fontSize="lg" fontWeight="bold">
                      Members ({channel.members?.length || 0})
                    </Text>
                    <Button
                      leftIcon={<AddIcon />}
                      size="sm"
                      onClick={onAddMemberOpen}
                    >
                      Add Members
                    </Button>
                  </Flex>
                </Box>
                
                <List spacing={2}>
                  {channel.members?.map((member) => (
                    <ListItem
                      key={member.id}
                      p={2}
                      borderRadius="md"
                      bg="gray.700"
                    >
                      <Flex align="center" justify="space-between">
                        <Flex align="center">
                          <Avatar
                            size="sm"
                            name={member.username}
                            src={member.avatar_url}
                            mr={2}
                          />
                          <Box>
                            <Text>{member.username}</Text>
                            {member.id === channel.created_by && (
                              <Text fontSize="xs" color="gray.400">
                                Creator
                              </Text>
                            )}
                          </Box>
                        </Flex>
                        
                        {member.id !== channel.created_by && (
                          <IconButton
                            icon={<DeleteIcon />}
                            variant="ghost"
                            colorScheme="red"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          />
                        )}
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              </TabPanel>

              {/* Invite Tab Panel */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel>Search Users</FormLabel>
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search users to invite..."
                      bg="gray.700"
                      border="1px"
                      borderColor="gray.600"
                      _hover={{ borderColor: 'gray.500' }}
                      _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                    />
                  </FormControl>
                  {isSearching ? (
                    <Flex justify="center" py={4}>
                      <Spinner color="blue.400" />
                    </Flex>
                  ) : (
                    <List spacing={2}>
                      {searchResults.map((user) => (
                        <ListItem
                          key={user.id}
                          p={2}
                          bg="gray.700"
                          borderRadius="md"
                        >
                          <Flex justify="space-between" align="center">
                            <Flex align="center" gap={2}>
                              <Avatar
                                size="sm"
                                name={user.username}
                                src={user.avatar_url}
                              />
                              <Text>{user.username}</Text>
                            </Flex>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={() => handleInviteUser(user.id)}
                            >
                              Invite
                            </Button>
                          </Flex>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            type="submit"
            form="channel-settings-form"
            isLoading={isLoading}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ChannelSettings; 