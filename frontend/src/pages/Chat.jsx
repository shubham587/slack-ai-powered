import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { initializeSocket, getSocket } from '../socket';
import {
  Input,
  Button,
  Avatar,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  InputGroup,
  InputLeftElement,
  Tooltip,
  Divider,
  Box,
  Flex,
  Text,
  HStack,
  Grid,
  useToast,
} from '@chakra-ui/react';
import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  SearchIcon,
  ChevronDownIcon,
  ChatIcon,
  BellIcon,
  HamburgerIcon,
  CloseIcon,
  SettingsIcon,
} from '@chakra-ui/icons';
import UserProfile from '../components/user/UserProfile';
import UserSettings from '../components/user/UserSettings';
import DirectMessage from '../components/messages/DirectMessage';
import ChannelSettings from '../components/channels/ChannelSettings';
import { fetchChannels, setActiveChannel, createChannel } from '../store/slices/channelsSlice';
import { fetchPendingInvitations } from '../store/slices/invitationsSlice';

const Chat = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const toast = useToast();
  const channels = useSelector(state => state.channels.channels);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [newChannelData, setNewChannelData] = useState({ name: '', description: '' });
  const [editingMessage, setEditingMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const messagesEndRef = useRef(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        await loadChannels();
        await loadRecentDirectMessages();
      } catch (error) {
        console.error('Error initializing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
    
    // Initialize socket with token
    const token = localStorage.getItem('token');
    if (token) {
      initializeSocket(token);
    }

    // Get socket instance
    const socket = getSocket();
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    // Join user's room for personal notifications after a short delay to ensure socket is connected
    const userId = user?.id;
    if (userId) {
      setTimeout(() => {
        socket.emit('join_user_room', { user_id: userId });
      }, 1000);
    }

    // Set up socket event listeners
    const handleNewMessage = (data) => {
      console.log('Received message:', data);
      if (data.channelId === currentChannel?.id) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [user?.id, currentChannel?.id]);

  useEffect(() => {
    if (currentChannel?.id) {
      joinChannel(currentChannel.id);
      loadMessages(currentChannel.id);
    } else {
      setMessages([]); // Clear messages when no channel is selected
    }
  }, [currentChannel]); // Only trigger when channel changes

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (currentChannel?.id) {
      scrollToBottom();
    }
  }, [currentChannel]);

  const loadChannels = async () => {
    try {
      setIsLoading(true);
      const result = await dispatch(fetchChannels()).unwrap();
      
      // If we have channels but no current channel selected, select the first one
      if (result.length > 0 && !currentChannel) {
        console.log('Setting initial channel:', result[0]);
        handleChannelSelect(result[0]);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (channelId) => {
    if (!channelId) {
      console.error('No channel ID provided for loading messages');
      return;
    }
    
    console.log('Loading messages for channel:', channelId);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/channel/${channelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received messages:', data);
      
      if (!Array.isArray(data)) {
        console.error('Received non-array messages data:', data);
        setMessages([]);
        return;
      }

      // Sort messages by timestamp in ascending order
      const sortedMessages = data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(sortedMessages);
      
      // Scroll to bottom after messages are loaded
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const joinChannel = (channelId) => {
    console.log('Joining channel:', channelId);
    const socket = getSocket();
    socket.emit('join', { channel: channelId });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChannel?.id) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/channel/${currentChannel.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: newMessage })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Emit socket event for real-time updates
      const socket = getSocket();
      socket.emit('new_message', {
        channelId: currentChannel.id,
        message: data
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Message no longer exists, update UI state
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
          toast({
            title: 'Message not found',
            description: 'This message may have been deleted',
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
        } else {
          throw new Error('Failed to update message');
        }
      } else {
        const data = await response.json();
        // Update the message in the UI
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, content: content } : msg
        ));
      }
      setEditingMessage(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: 'Error',
        description: 'Failed to update message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Message already deleted, just update UI
          setMessages(prev => prev.filter(msg => msg.id !== messageId));
          toast({
            title: 'Message already deleted',
            description: 'The message was already removed',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
        } else {
          throw new Error('Failed to delete message');
        }
      } else {
        // Update UI to remove the message
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        toast({
          title: 'Message deleted',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCreateChannel = async () => {
    try {
      const result = await dispatch(createChannel(newChannelData)).unwrap();
      setShowNewChannelModal(false);
      setNewChannelData({ name: '', description: '' });
      handleChannelSelect(result); // Select the newly created channel
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      const socket = getSocket();
      socket.emit('typing', { channel: currentChannel?.id });
      setTimeout(() => setIsTyping(false), 3000);
    }
  };

  // Channel selection handler
  const handleChannelSelect = (channel) => {
    console.log('Selecting channel:', channel);
    setCurrentChannel(channel);
    if (channel?.id) {
      joinChannel(channel.id);
      loadMessages(channel.id);
    }
  };

  const loadRecentDirectMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/recent-chats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load recent chats');
      }

      const data = await response.json();
      setDirectMessages(data);
    } catch (error) {
      console.error('Error loading recent direct messages:', error);
    }
  };

  const handleDirectMessageSelect = async (user) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/direct/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load direct messages');
      }

      const data = await response.json();
      
      // Create a virtual channel for direct messages
      const dmChannel = {
        id: data.channel_id,
        name: user.username,
        isDirect: true,
        members: [user.id],
        avatar_url: user.avatar_url,
        display_name: user.display_name || user.username
      };

      setCurrentChannel(dmChannel);
      setMessages(data.messages || []);
      setIsDirectMessageOpen(false);
      
      // Join the DM channel socket room
      joinChannel(data.channel_id);
      scrollToBottom();
    } catch (error) {
      console.error('Error loading direct messages:', error);
    }
  };

  return (
    <Grid templateColumns="250px 1fr" h="100vh" bg="gray.900">
      {/* Sidebar */}
      <Box bg="gray.800" borderRight="1px" borderColor="gray.700" overflow="hidden" display="flex" flexDirection="column">
        {/* Workspace Header */}
        <Flex p={4} borderBottom="1px" borderColor="gray.700" align="center" justify="space-between" bg="gray.800">
          <Text key="workspace-title" color="white" fontWeight="bold" fontSize="lg">Workspace</Text>
          <HStack spacing={2}>
            <Tooltip key="profile-tooltip" label="Profile" placement="bottom">
              <Avatar
                key="user-avatar"
                size="sm"
                name={user?.display_name || user?.username}
                src={user?.avatar_url}
                cursor="pointer"
                onClick={() => setIsProfileOpen(true)}
              />
            </Tooltip>
            <Tooltip key="settings-tooltip" label="Settings" placement="bottom">
              <IconButton
                key="settings-button"
                icon={<SettingsIcon />}
                variant="ghost"
                colorScheme="whiteAlpha"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
              />
            </Tooltip>
          </HStack>
        </Flex>

        {/* Sidebar Content */}
        <Box flex="1" overflowY="auto" py={4} className="custom-scrollbar">
          {/* Search */}
          <Box px={4} mb={4}>
            <InputGroup size="sm">
              <InputLeftElement pointerEvents="none">
                <SearchIcon key="search-icon" color="gray.400" />
              </InputLeftElement>
              <Input
                key="search-input"
                placeholder="Search channels"
                bg="gray.700"
                border="1px"
                borderColor="gray.600"
                _placeholder={{ color: 'gray.400' }}
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
              />
            </InputGroup>
          </Box>

          {/* Channels Section */}
          <Box px={4} mb={4}>
            <Flex align="center" justify="space-between" mb={2}>
              <Text key="channels-title" color="gray.300" fontWeight="medium" fontSize="sm">Channels</Text>
              <IconButton
                key="add-channel-button"
                icon={<AddIcon />}
                variant="ghost"
                colorScheme="whiteAlpha"
                size="xs"
                onClick={() => setShowNewChannelModal(true)}
              />
            </Flex>
            <Box>
              {channels.map((channel, index) => (
                <Button
                  key={`channel-${channel.id}-${index}`}
                  onClick={() => handleChannelSelect(channel)}
                  variant="ghost"
                  justifyContent="flex-start"
                  w="full"
                  h="auto"
                  py={1}
                  px={2}
                  color="gray.300"
                  bg={currentChannel?.id === channel.id ? 'blue.600' : 'transparent'}
                  _hover={{ bg: currentChannel?.id === channel.id ? 'blue.700' : 'gray.700' }}
                  leftIcon={<span key={`hash-${channel.id}`} className="text-lg">#</span>}
                >
                  <Text key={`name-${channel.id}`} fontSize="sm" isTruncated>{channel.name}</Text>
                </Button>
              ))}
            </Box>
          </Box>

          {/* Direct Messages Section */}
          <Box px={4}>
            <Flex align="center" justify="space-between" mb={2}>
              <Text color="gray.300" fontWeight="medium" fontSize="sm">Direct Messages</Text>
              <IconButton
                key="add-dm-button"
                icon={<AddIcon />}
                variant="ghost"
                colorScheme="whiteAlpha"
                size="xs"
                onClick={() => setIsDirectMessageOpen(true)}
                aria-label="Add Direct Message"
              />
            </Flex>
            <Box>
              {directMessages.map((dm) => (
                <Button
                  key={dm.user.id}
                  onClick={() => handleDirectMessageSelect(dm.user)}
                  variant="ghost"
                  justifyContent="flex-start"
                  w="full"
                  h="auto"
                  py={1}
                  px={2}
                  color="gray.300"
                  bg={currentChannel?.id === dm.channel_id ? 'blue.600' : 'transparent'}
                  _hover={{ bg: currentChannel?.id === dm.channel_id ? 'blue.700' : 'gray.700' }}
                  leftIcon={
                    <Avatar size="xs" name={dm.user.username} src={dm.user.avatar_url} />
                  }
                >
                  <Box flex="1" textAlign="left">
                    <Text fontSize="sm" isTruncated>{dm.user.username}</Text>
                    {dm.last_message && (
                      <Text fontSize="xs" color="gray.400" isTruncated>
                        {dm.last_message.content}
                      </Text>
                    )}
                  </Box>
                </Button>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Main Chat Area */}
      <Flex direction="column" bg="gray.900" overflow="hidden">
        {/* Channel Header */}
        {currentChannel && (
          <Flex
            h="64px"
            px={6}
            align="center"
            justify="space-between"
            borderBottom="1px"
            borderColor="gray.700"
            bg="gray.800"
          >
            <Flex align="center" gap={4}>
              <Box>
                <Flex align="center" gap={2}>
                  <Text key="channel-hash" color="gray.400" fontSize="lg">#</Text>
                  <Text key="channel-name" color="white" fontWeight="medium" fontSize="lg">
                    {currentChannel.name}
                  </Text>
                </Flex>
                {currentChannel.description && (
                  <Text key="channel-description" color="gray.400" fontSize="sm">
                    {currentChannel.description}
                  </Text>
                )}
              </Box>
            </Flex>
            <HStack spacing={2}>
              <Tooltip key="thread-tooltip" label="Thread View">
                <IconButton
                  key="thread-button"
                  icon={<ChatIcon />}
                  variant="ghost"
                  colorScheme="whiteAlpha"
                  size="sm"
                  onClick={() => setShowThreadPanel(!showThreadPanel)}
                />
              </Tooltip>
              <Tooltip key="settings-tooltip" label="Channel Settings">
                <IconButton
                  key="settings-button"
                  icon={<SettingsIcon />}
                  variant="ghost"
                  colorScheme="whiteAlpha"
                  size="sm"
                  onClick={() => setShowChannelSettings(true)}
                />
              </Tooltip>
            </HStack>
          </Flex>
        )}

        {/* Messages Area */}
        <Flex flex="1" overflow="hidden">
          <Box flex="1" display="flex" flexDirection="column" minW={0}>
            {/* Messages List */}
            <Box 
              flex="1" 
              overflowY="auto" 
              px={6} 
              py={4} 
              className="custom-scrollbar"
              css={{
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              <Box spacing={4} display="flex" flexDirection="column" minHeight="100%">
                <Box flex="1" />
                {Array.isArray(messages) && messages.map((message) => (
                  <Box
                    key={`message-container-${message._id || message.id}`}
                    py={2}
                    px={4}
                    mx={-4}
                    _hover={{ bg: 'gray.800' }}
                    borderRadius="md"
                    transition="background 0.2s"
                    role="group"
                  >
                    <Flex key={`message-flex-${message._id || message.id}`} gap={3}>
                      <Avatar
                        key={`message-avatar-${message._id || message.id}`}
                        size="sm"
                        name={message.username}
                        src={message.avatar_url}
                      />
                      <Box key={`message-content-${message._id || message.id}`} flex="1" minW={0}>
                        <Flex key={`message-header-${message._id || message.id}`} align="baseline" gap={2}>
                          <Text key={`message-username-${message._id || message.id}`} fontWeight="bold" color="white">
                            {message.username}
                          </Text>
                          <Text key={`message-time-${message._id || message.id}`} fontSize="xs" color="gray.400">
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </Text>
                        </Flex>
                        {editingMessage?.id === message.id ? (
                          <form key={`message-edit-form-${message._id || message.id}`} onSubmit={(e) => {
                            e.preventDefault();
                            handleEditMessage(message.id, editingMessage.content);
                          }}>
                            <Input
                              key={`message-edit-input-${message._id || message.id}`}
                              value={editingMessage.content}
                              onChange={(e) => setEditingMessage({
                                ...editingMessage,
                                content: e.target.value
                              })}
                              mt={1}
                              size="sm"
                              autoFocus
                            />
                          </form>
                        ) : (
                          <Text key={`message-text-${message._id || message.id}`} color="gray.100" whiteSpace="pre-wrap">
                            {message.content}
                          </Text>
                        )}
                      </Box>
                      {message.sender_id === user?.id && (
                        <HStack key={`message-actions-${message._id || message.id}`} spacing={1} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                          <IconButton
                            key={`message-edit-btn-${message._id || message.id}`}
                            icon={<EditIcon />}
                            size="xs"
                            variant="ghost"
                            colorScheme="whiteAlpha"
                            onClick={() => setEditingMessage(message)}
                          />
                          <IconButton
                            key={`message-delete-btn-${message._id || message.id}`}
                            icon={<DeleteIcon />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDeleteMessage(message.id)}
                          />
                        </HStack>
                      )}
                    </Flex>
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Box>
            </Box>

            {/* Message Input */}
            <Box key="message-input-container" px={6} py={4} borderTop="1px" borderColor="gray.700">
              <form key="message-input-form" onSubmit={handleSendMessage}>
                <Box key="message-input-box" position="relative">
                  <Input
                    key="message-input"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder={currentChannel ? `Message #${currentChannel.name}` : 'Select a channel to start messaging'}
                    size="lg"
                    bg="gray.800"
                    border="1px"
                    borderColor="gray.600"
                    _hover={{ borderColor: 'gray.500' }}
                    _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                    _placeholder={{ color: 'gray.400' }}
                    disabled={!currentChannel}
                  />
                  {typingUsers.size > 0 && (
                    <Text
                      key="typing-indicator"
                      position="absolute"
                      top="-20px"
                      left={0}
                      fontSize="xs"
                      color="gray.400"
                    >
                      {Array.from(typingUsers).map((username, index) => (
                        <span key={`typing-${username}`}>
                          {index > 0 && ', '}
                          {username}
                        </span>
                      ))} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                    </Text>
                  )}
                </Box>
              </form>
            </Box>
          </Box>

          {/* Thread Panel */}
          {showThreadPanel && (
            <Box w="400px" borderLeft="1px" borderColor="gray.700" bg="gray.800">
              <Flex h="64px" px={4} align="center" justify="space-between" borderBottom="1px" borderColor="gray.700">
                <Text key="thread-title" color="white" fontWeight="medium">Thread</Text>
                <IconButton
                  key="close-thread-button"
                  icon={<CloseIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="whiteAlpha"
                  onClick={() => setShowThreadPanel(false)}
                />
              </Flex>
              <Box p={4}>
                <Text key="no-thread-text" color="gray.400" textAlign="center">No thread selected</Text>
              </Box>
            </Box>
          )}
        </Flex>
      </Flex>

      {/* Modals */}
      <Modal isOpen={showNewChannelModal} onClose={() => setShowNewChannelModal(false)}>
        <ModalOverlay />
        <ModalContent bg="gray.800">
          <ModalHeader key="modal-header" borderBottom="1px" borderColor="gray.700" color="white">
            Create a new channel
          </ModalHeader>
          <ModalCloseButton key="modal-close" color="gray.400" />
          <ModalBody key="modal-body" py={6}>
            <FormControl key="name-control">
              <FormLabel key="name-label" color="gray.300">Channel name</FormLabel>
              <Input
                key="name-input"
                value={newChannelData.name}
                onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                placeholder="e.g. project-updates"
                bg="gray.700"
                border="1px"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
              />
            </FormControl>
            <FormControl key="description-control" mt={4}>
              <FormLabel key="description-label" color="gray.300">Description</FormLabel>
              <Textarea
                key="description-input"
                value={newChannelData.description}
                onChange={(e) => setNewChannelData({ ...newChannelData, description: e.target.value })}
                placeholder="What's this channel about?"
                bg="gray.700"
                border="1px"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter key="modal-footer" borderTop="1px" borderColor="gray.700">
            <Button
              key="cancel-button"
              variant="ghost"
              mr={3}
              onClick={() => setShowNewChannelModal(false)}
              color="white"
              _hover={{ bg: 'gray.700' }}
            >
              Cancel
            </Button>
            <Button
              key="create-button"
              colorScheme="blue"
              onClick={handleCreateChannel}
            >
              Create Channel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Profile Modal */}
      <UserProfile key="user-profile-modal" isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Settings Modal */}
      <UserSettings key="user-settings-modal" isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Add DirectMessage Modal */}
      <DirectMessage
        isOpen={isDirectMessageOpen}
        onClose={() => setIsDirectMessageOpen(false)}
        onSelectUser={handleDirectMessageSelect}
      />

      {/* Channel Settings Modal */}
      <ChannelSettings 
        isOpen={showChannelSettings}
        onClose={() => setShowChannelSettings(false)}
        channelId={currentChannel?.id}
      />
    </Grid>
  );
};

export default Chat; 