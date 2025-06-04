import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { selectChannels } from '../store/slices/channelsSlice';
import { initializeSocket, getSocket, joinChannel, leaveChannel, disconnectSocket } from '../socket';
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
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  VStack,
  Heading,
  useColorMode,
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
  AttachmentIcon,
  DownloadIcon,
} from '@chakra-ui/icons';
import UserProfile from '../components/user/UserProfile';
import UserSettings from '../components/user/UserSettings';
import DirectMessage from '../components/messages/DirectMessage';
import ChannelSettings from '../components/channels/ChannelSettings';
import { fetchChannels, setActiveChannel, createChannel, pinMessage, unpinMessage } from '../store/slices/channelsSlice';
import { fetchPendingInvitations } from '../store/slices/invitationsSlice';
import MessageInput from '../components/messages/MessageInput';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { AiFillPushpin, AiOutlinePushpin, AiOutlineRobot } from 'react-icons/ai';
import ThreadPanel from '../components/messages/ThreadPanel';
import AutoReplyComposer from '../components/ai/AutoReplyComposer';
import LogoutButton from '../components/common/LogoutButton';
import { FaHashtag } from 'react-icons/fa';
import { BsChatDots } from 'react-icons/bs';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { selectChannelMessages, setMessages, setLoading, setError } from '../store/slices/messagesSlice';
import { createSelector } from 'reselect';
import { FiFileText } from 'react-icons/fi';
import NotesModal from '../components/notes/NotesModal';
import CreateChannelModal from '../components/channels/CreateChannelModal';

// Helper functions
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  // Convert to IST by adding 5 hours and 30 minutes
  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  
  if (diffInDays === 0) {
    // Today - show time only in IST
    return istDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } else if (diffInDays === 1) {
    // Yesterday
    return 'Yesterday';
  } else if (diffInDays < 7) {
    // Within a week - show day name
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    // Older - show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const WelcomeView = () => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    flex={1}
    p={8}
    textAlign="center"
    color="gray.400"
  >
    <VStack spacing={6}>
      <Icon as={BsChatDots} boxSize={12} />
      <VStack spacing={2}>
        <Heading size="lg" color="white">
          Welcome to Slack AI-Powered
        </Heading>
        <Text fontSize="lg">
          Select a channel or direct message to start chatting
        </Text>
      </VStack>
      <HStack spacing={6} mt={4}>
        <VStack>
          <Icon as={FaHashtag} boxSize={6} />
          <Text>Join a channel</Text>
        </VStack>
        <VStack>
          <Icon as={ChatIcon} boxSize={6} />
          <Text>Start a conversation</Text>
        </VStack>
      </HStack>
    </VStack>
  </Flex>
);

// Main component
export default function Chat() {
  // 1. Context hooks first
  const { colorMode } = useColorMode();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const channels = useSelector(selectChannels);
  const toast = useToast();
  const navigate = useNavigate();
  
  // 2. Refs
  const messagesEndRef = useRef(null);

  // 3. State declarations
  const [currentChannel, setCurrentChannel] = useState(null);
  const [selectedDmId, setSelectedDmId] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [filteredDirectMessages, setFilteredDirectMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [newChannelData, setNewChannelData] = useState({ name: '', description: '' });
  const [editingMessage, setEditingMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [showAIComposer, setShowAIComposer] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);

  // 4. Memoized selectors that depend on state
  const selectMessagesForChannel = useMemo(
    () => createSelector(
      [(state) => state.messages.messages, () => currentChannel?.id],
      (messages, channelId) => channelId ? messages[channelId] || [] : []
    ),
    [currentChannel?.id]
  );

  // 5. Selectors that depend on memoized selectors
  const messages = useSelector(selectMessagesForChannel);
  const isMessagesLoading = useSelector(state => state.messages.loading);

  // 6. Memoized values that depend on messages and other state
  const currentPinnedMessages = useMemo(() => {
    if (currentChannel?.pinned_messages?.length > 0 && messages.length > 0) {
      return messages.filter(msg => 
        currentChannel.pinned_messages.includes(msg.id)
      );
    }
    return [];
  }, [currentChannel?.pinned_messages, messages]);

  const currentFilteredChannels = useMemo(() => {
    const channelsArray = Object.values(channels || {}).filter(channel => !channel.is_direct);
    if (!searchTerm.trim()) {
      return channelsArray;
    }
    const searchTermLower = searchTerm.toLowerCase();
    return channelsArray.filter(channel => 
      channel.name.toLowerCase().includes(searchTermLower) ||
      channel.description?.toLowerCase().includes(searchTermLower)
    );
  }, [channels, searchTerm]);

  const currentFilteredDirectMessages = useMemo(() => {
    if (!userSearchTerm.trim()) {
      return directMessages;
    }
    const searchTermLower = userSearchTerm.toLowerCase();
    return directMessages.filter(dm => 
      dm.user.username.toLowerCase().includes(searchTermLower) ||
      dm.user.display_name?.toLowerCase().includes(searchTermLower)
    );
  }, [directMessages, userSearchTerm]);

  // 7. Callbacks
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, []);

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) {
      console.error('No channel ID provided for loading messages');
      return;
    }
    
    try {
      dispatch(setLoading(true));
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
      
      if (!Array.isArray(data)) {
        console.error('Received non-array messages data:', data);
        dispatch(setMessages({ channelId, messages: [] }));
        return;
      }

      // Sort messages in ascending order by creation date
      const sortedMessages = data
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(msg => ({
          ...msg,
          reply_count: msg.reply_count || 0,
          is_direct: currentChannel?.is_direct || false
        }));

      dispatch(setMessages({ channelId, messages: sortedMessages }));
      
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
      setTimeout(scrollToBottom, 100);
      });
    } catch (error) {
      console.error('Error loading messages:', error);
      dispatch(setError(error.message));
      dispatch(setMessages({ channelId, messages: [] }));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, currentChannel?.is_direct, scrollToBottom]);

  const loadRecentDirectMessages = useCallback(async () => {
    try {
      if (!user || !user.id) {
        console.error('User not authenticated');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/recent-chats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!Array.isArray(response.data)) {
        console.error('Received non-array data:', response.data);
        setDirectMessages([]);
        setFilteredDirectMessages([]);
        return;
      }

      const transformedData = response.data.map(chat => ({
        user: {
          id: chat.user.id,
          username: chat.user.username,
          display_name: chat.user.display_name || chat.user.username,
          avatar_url: chat.user.avatar_url
        },
        last_message: chat.last_message,
        channel_id: chat.channel_id
      }));

      setDirectMessages(transformedData);
      setFilteredDirectMessages(transformedData);
    } catch (error) {
      console.error('Error loading recent direct messages:', error);
      toast({
        title: 'Error loading direct messages',
        description: error.response?.data?.error || error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setDirectMessages([]);
      setFilteredDirectMessages([]);
    }
  }, [user, toast]);

  const handleSendMessage = useCallback(async (messageData, isFile = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !currentChannel?.id) {
        throw new Error('Not authenticated or no channel selected');
      }

      const formData = new FormData();
      if (isFile && messageData.file) {
        formData.append('file', messageData.file);
      }
      if (messageData.content) {
        formData.append('content', messageData.content);
        }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/channel/${currentChannel.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...(isFile ? {} : { 'Content-Type': 'application/json' })
          },
          body: isFile ? formData : JSON.stringify({ content: messageData.content })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Reload messages to include the new one
      await loadMessages(currentChannel.id);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [currentChannel?.id, loadMessages, scrollToBottom, toast]);

  const handleChannelSelect = useCallback((channel) => {
    console.log('Selecting channel:', {
      channelId: channel?.id,
      isDirect: channel?.is_direct,
      userId: user?.id
    });
    
    const socket = getSocket();
    const userId = user?.id || localStorage.getItem('user_id');
    
    // Leave current channel if any
    if (currentChannel?.id) {
      console.log('Leaving current channel:', currentChannel.id);
      socket.emit('leave', { 
        channel: currentChannel.id,
        user_id: userId
      });
    }
    
    // Always close thread when switching channels
    setShowThreadPanel(false);
    setActiveThread(null);
    setShowAIComposer(false);
    setSelectedMessage(null);
    
    setCurrentChannel(channel);
    setSelectedDmId(null);
    
    if (channel?.id) {
      // Join new channel
      console.log('Joining new channel:', channel.id);
      socket.emit('join', { 
        channel: channel.id,
        user_id: userId
      });
      loadMessages(channel.id);
    }
  }, [currentChannel?.id, loadMessages, user?.id]);

  const handleDirectMessageSelect = useCallback(async (user, existingChannelId = null) => {
    try {
      const token = localStorage.getItem('token');
      let channelId = existingChannelId;
      let messages = [];
      let channelData = null;

      // Leave current channel if any
      if (currentChannel?.id) {
        console.log('Leaving current channel:', currentChannel.id);
        leaveChannel(currentChannel.id);
      }

    if (!channelId) {
        // If no existing channel ID, create/get one
        console.log('Creating/getting DM channel for user:', user.id);
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
        channelId = data.channel_id;
        messages = data.messages || [];
        channelData = data;
        console.log('Got DM channel ID:', channelId);
      } else {
        // If we have a channel ID, just load messages for that channel
        console.log('Loading messages for existing DM channel:', channelId);
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/channel/${channelId}`,
          {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
          }
        );

      if (!response.ok) {
          throw new Error('Failed to load messages');
        }

        messages = await response.json();
      }
      
      // Always close thread when switching to DM
      setShowThreadPanel(false);
      setActiveThread(null);
      setShowAIComposer(false);
      setSelectedMessage(null);
      
      // Create a virtual channel for direct messages
      const dmChannel = {
        id: channelId,
        name: channelData?.name || user.display_name || user.username,
        is_direct: true,
        members: [user.id, user?.id], // Include both users
        avatar_url: user.avatar_url,
        display_name: channelData?.name || user.display_name || user.username,
        description: channelData?.description || `Direct message with ${user.display_name || user.username}`,
        type: 'direct'
      };

      console.log('Setting up DM channel:', dmChannel);
      setCurrentChannel(dmChannel);
      setSelectedDmId(channelId);
      
      // Ensure messages have the is_direct flag
      const messagesWithDmFlag = messages.map(msg => ({
        ...msg,
        is_direct: true,
        channel_id: channelId
      }));
      dispatch(setMessages({ channelId, messages: messagesWithDmFlag }));
      
      setIsDirectMessageOpen(false);
      
      // Join the DM channel and ensure user room is joined
      const socket = getSocket();
      if (socket) {
        console.log('Joining DM channel:', channelId);
        socket.emit('join', { channel: channelId });
        // Ensure user room is joined
        const userId = localStorage.getItem('user_id');
        if (userId) {
          console.log('Ensuring user room is joined:', userId);
          socket.emit('join_user_room', { user_id: userId });
        }
      }

        scrollToBottom();
    } catch (error) {
      console.error('Error loading direct messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load direct messages',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [currentChannel?.id, dispatch, scrollToBottom]);

  const handleNewReply = (data) => {
    // Update the message in the messages list with the new reply count
    setMessages(prev => prev.map(msg => {
      if ((msg._id || msg.id) === (data.parent_id || data.parent_message_id)) {
        // Get the actual reply count from the thread
        const replyCount = data.reply_count || (msg.reply_count ? msg.reply_count + 1 : 1);
        return {
          ...msg,
          reply_count: replyCount
        };
      }
      return msg;
    }));
  };

  const handleAIReply = useCallback(async (replyText) => {
    try {
      await handleSendMessage({ content: replyText });
      setShowAIComposer(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error sending AI reply:', error);
    }
  }, [handleSendMessage]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete message');
        }

      // Update messages in the current channel
      if (currentChannel?.id) {
        dispatch(setMessages({
          channelId: currentChannel.id,
          messages: messages.filter(msg => (msg._id !== messageId && msg.id !== messageId))
        }));
      }

        toast({
          title: 'Message deleted',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error deleting message',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [currentChannel?.id, messages, dispatch, toast]);

  const handleEditMessage = useCallback(async (messageId, newContent) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${messageId}`,
        {
          method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: newContent }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const updatedMessage = await response.json();
      
      // Update messages in the current channel only
      if (currentChannel?.id) {
        dispatch(setMessages({
          channelId: currentChannel.id,
          messages: messages.map(msg => 
            (msg._id === messageId || msg.id === messageId) ? updatedMessage : msg
          )
        }));
      }

      setEditingMessage(null);
      
      toast({
        title: 'Message updated',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to edit message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [currentChannel?.id, messages, dispatch, toast]);

  // 8. Effects
  useEffect(() => {
    setPinnedMessages(currentPinnedMessages);
  }, [currentPinnedMessages]);

  useEffect(() => {
    setFilteredChannels(currentFilteredChannels);
  }, [currentFilteredChannels]);

  useEffect(() => {
    setFilteredDirectMessages(currentFilteredDirectMessages);
  }, [currentFilteredDirectMessages]);

  useEffect(() => {
    if (messageSearchTerm.trim() === '') {
      setFilteredMessages(messages);
    } else {
      const searchTermLower = messageSearchTerm.toLowerCase();
      const filtered = messages.filter(message => 
        message.content?.toLowerCase().includes(searchTermLower) ||
        message.username?.toLowerCase().includes(searchTermLower)
      );
      setFilteredMessages(filtered);
    }
  }, [messages, messageSearchTerm]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (currentChannel?.id) {
      loadMessages(currentChannel.id);
    } else {
      dispatch(setMessages({ channelId: null, messages: [] }));
    }
  }, [currentChannel?.id, loadMessages, dispatch]);

  useEffect(() => {
    dispatch(fetchChannels());
  }, [dispatch]);

  useEffect(() => {
    loadRecentDirectMessages();
  }, [loadRecentDirectMessages]);

    return (
    <Flex h="100vh" overflow="hidden">
      {/* Sidebar */}
      <Box 
        w="250px"
        h="100%"
        bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
        borderRight="1px"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        display={{ base: showSidebar ? 'block' : 'none', md: 'block' }}
        position="relative"
      >
        <Flex direction="column" h="100%">
          {/* User Section */}
          <Flex p={4} justify="space-between" align="center" borderBottom="1px" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
            <HStack spacing={3}>
              <Avatar size="sm" name={user?.display_name} src={user?.avatar_url} onClick={() => setIsProfileOpen(true)} cursor="pointer" />
              <Text fontWeight="bold">{user?.display_name || user?.username}</Text>
            </HStack>
        <IconButton
              icon={<SettingsIcon />}
              variant="ghost"
          size="sm"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
        />
          </Flex>
        
          {/* Channels and DMs Section */}
          <Box flex="1" overflowY="auto" p={4}>
            {/* Channels */}
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="bold">Channels</Text>
              <IconButton
                  icon={<AddIcon />}
                size="sm"
                  onClick={() => setShowNewChannelModal(true)}
                  aria-label="Add Channel"
                  variant="ghost"
                  _hover={{ bg: colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.200' }}
              />
          </HStack>

              {/* Channel Search */}
              <InputGroup>
              <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.500" />
              </InputLeftElement>
              <Input
                  placeholder="Search channels"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                  size="sm"
              />
            </InputGroup>

              {/* Channel List */}
              <VStack spacing={1} align="stretch">
                {filteredChannels.map(channel => (
                <Button
                    key={channel.id}
                    variant={currentChannel?.id === channel.id ? 'solid' : 'ghost'}
                  justifyContent="flex-start"
                    leftIcon={<FaHashtag />}
                    onClick={() => handleChannelSelect(channel)}
                    size="sm"
                    w="100%"
                  >
                    {channel.name}
                </Button>
              ))}
              </VStack>

              {/* Direct Messages */}
              <Box mt={4}>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="lg" fontWeight="bold">Direct Messages</Text>
              <IconButton
                    icon={<ChatIcon />}
                    size="sm"
                onClick={() => setIsDirectMessageOpen(true)}
                    aria-label="New Direct Message"
              />
                </HStack>
                <VStack spacing={1} align="stretch">
                  {filteredDirectMessages.map(dm => (
                <Button
                      key={dm.channel_id}
                      variant={selectedDmId === dm.channel_id ? 'solid' : 'ghost'}
                  justifyContent="flex-start"
                      onClick={() => handleDirectMessageSelect(dm.user, dm.channel_id)}
                      size="sm"
                      w="100%"
                    >
                      <HStack spacing={2}>
                        <Avatar size="xs" name={dm.user.display_name} src={dm.user.avatar_url} />
                        <Text>{dm.user.display_name}</Text>
                      </HStack>
                </Button>
              ))}
                </VStack>
            </Box>
            </VStack>
        </Box>

          {/* Logout Button */}
          <Box p={4} borderTop="1px" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
            <LogoutButton w="100%" />
        </Box>
        </Flex>
      </Box>

      {/* Main Chat Area */}
      <Flex 
        direction="column" 
        flex="1" 
        h="100vh" 
        bg={colorMode === 'dark' ? 'gray.900' : 'white'}
        transition="width 0.2s"
        w={showThreadPanel ? "60%" : "100%"}
      >
        {/* Channel Header */}
          <Flex
          p={4} 
            borderBottom="1px"
          borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'} 
          justify="space-between" 
          align="center"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        >
          <HStack>
            <IconButton
              icon={showSidebar ? <CloseIcon /> : <HamburgerIcon />}
              onClick={() => setShowSidebar(!showSidebar)}
              display={{ base: 'flex', md: 'none' }}
              variant="ghost"
              aria-label="Toggle Sidebar"
            />
            <Box>
              {currentChannel ? (
                <HStack spacing={2}>
                  {currentChannel.is_direct ? (
                    <>
                      <Avatar size="xs" name={currentChannel.name} src={currentChannel.avatar_url} />
                      <Text fontSize="lg" fontWeight="bold">{currentChannel.name}</Text>
                    </>
                  ) : (
                    <>
                      <FaHashtag />
                      <Text fontSize="lg" fontWeight="bold">{currentChannel.name}</Text>
                    </>
                  )}
                </HStack>
              ) : (
                <Text fontSize="lg" fontWeight="bold">Welcome to Slack AI-Powered</Text>
              )}
            </Box>
          </HStack>
          
          {currentChannel && (
            <HStack>
              <IconButton
                icon={<FiFileText />}
                onClick={() => {
                  const channelId = currentChannel?.id || currentChannel?._id;
                  if (!channelId) {
                    toast({
                      title: "Error",
                      description: "Cannot generate notes: Channel ID is missing",
                      status: "error",
                      duration: 3000,
                      isClosable: true,
                    });
                    return;
                  }
                  setShowNotesModal(true);
                }}
                aria-label="Channel Notes"
                variant="ghost"
              />
              <IconButton
                icon={<SettingsIcon />}
                onClick={() => setShowChannelSettings(true)}
                aria-label="Channel Settings"
                variant="ghost"
              />
            </HStack>
          )}
        </Flex>

        {/* Show Welcome View when no channel is selected */}
        {!currentChannel ? (
          <WelcomeView />
        ) : (
          <>
            {/* Messages Area */}
            <VStack
              flex="1" 
              spacing={4}
              overflowY="auto" 
              p={4}
              align="stretch"
              bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
            >
              {/* Pinned Messages Section */}
              {currentChannel?.pinned_messages?.length > 0 && (
                <>
                  <Box 
                    p={3} 
                    bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                    borderRadius="md"
                    borderLeft="4px"
                    borderColor="blue.500"
                  >
                    <Text fontWeight="bold" mb={2} color={colorMode === 'dark' ? 'white' : 'gray.800'}>
                      📌 Pinned Messages
                    </Text>
                    <VStack spacing={2} align="stretch">
                      {messages
                        .filter(msg => currentChannel.pinned_messages.includes(msg.id))
                        .map(message => {
                          const messageId = message._id || message.id;
                          return (
                            <Box
                              key={`pinned-${messageId}`}
                              p={2}
                              bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                              borderRadius="md"
                            >
                              <Flex gap={2} align="center">
                                <Avatar size="xs" name={message.username} src={message.avatar_url} />
                                <Text fontWeight="bold" fontSize="sm">{message.username}</Text>
                                <Text fontSize="xs" color="gray.500">{formatTimestamp(message.created_at)}</Text>
                              </Flex>
                              <Text mt={1} fontSize="sm" color={colorMode === 'dark' ? 'gray.100' : 'gray.800'}>
                                {message.content}
                              </Text>
                            </Box>
                          );
                        })}
                    </VStack>
                  </Box>
                  <Divider />
                </>
              )}

              {/* Regular Messages */}
              {messages.map((message) => {
                const messageId = message._id || message.id;
                const isEditing = editingMessage && (editingMessage._id === messageId || editingMessage.id === messageId);
                
                return (
                  <Box
                    key={messageId}
                    position="relative"
                    role="group"
                    p={3}
                    bg={message.sender_id === user?.id 
                      ? (colorMode === 'dark' ? 'blue.900' : 'blue.50')
                      : (colorMode === 'dark' ? 'gray.800' : 'gray.50')
                    }
                    borderRadius="md"
                  >
                    <Flex gap={3}>
                      <Avatar size="sm" name={message.username} src={message.avatar_url} />
                      <Box flex="1">
                        <Flex justify="space-between" align="center" mb={1}>
                          <Flex align="center" gap={2}>
                            <Text fontWeight="bold" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
                              {message.username}
                            </Text>
                            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                              {formatTimestamp(message.created_at)}
                            </Text>
                          </Flex>

                          {/* Context Menu */}
                          <Box 
                            opacity="0" 
                            _groupHover={{ opacity: 1 }} 
                            transition="opacity 0.2s"
                          >
                            <Menu>
                              <MenuButton
                                as={IconButton}
                                icon={<BsThreeDotsVertical />}
                                variant="ghost"
                                size="sm"
                                color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
                                _hover={{ 
                                  color: colorMode === 'dark' ? 'white' : 'gray.800',
                                  bg: colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.200'
                                }}
                              />
                              <MenuList 
                                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                                borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
                              >
                                <MenuItem
                                  icon={<ChatIcon />}
                                  onClick={() => {
                                    setActiveThread(message);
                                    setShowThreadPanel(true);
                                  }}
                                  bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                                  _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                                  color={colorMode === 'dark' ? 'white' : 'gray.800'}
                                >
                                  Reply in Thread
                                </MenuItem>
                                <MenuItem
                                  icon={<AiOutlineRobot />}
                                  onClick={() => {
                                    // First open the thread
                                    setActiveThread(message);
                                    setShowThreadPanel(true);
                                    // Then set up the AI composer with quick reply settings
                                    setSelectedMessage({
                                      ...message,
                                      isQuickReply: true,
                                      useFullContext: false,
                                      inThread: true // New flag to indicate this is in a thread
                                    });
                                    setShowAIComposer(true);
                                  }}
                                  bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                                  _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                                  color={colorMode === 'dark' ? 'white' : 'gray.800'}
                                >
                                  Quick Reply Suggestion
                                </MenuItem>
                                <MenuItem
                                  icon={currentChannel?.pinned_messages?.includes(message.id) ? <AiFillPushpin /> : <AiOutlinePushpin />}
                                  onClick={() => {
                                    if (currentChannel?.pinned_messages?.includes(message.id)) {
                                      dispatch(unpinMessage({ channelId: currentChannel.id, messageId: message.id }));
                                    } else {
                                      dispatch(pinMessage({ channelId: currentChannel.id, messageId: message.id }));
                                    }
                                  }}
                                  bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                                  _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                                  color={colorMode === 'dark' ? 'white' : 'gray.800'}
                                >
                                  {currentChannel?.pinned_messages?.includes(message.id) ? 'Unpin Message' : 'Pin Message'}
                                </MenuItem>
                                {message.sender_id === user?.id && (
                                  <>
                                    <MenuDivider borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
                                    <MenuItem
                                      icon={<EditIcon />}
                                      onClick={() => setEditingMessage(message)}
                                      bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                                      _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                                      color={colorMode === 'dark' ? 'white' : 'gray.800'}
                                    >
                                      Edit Message
                                    </MenuItem>
                                    <MenuItem
                                      icon={<DeleteIcon />}
                                      onClick={() => handleDeleteMessage(messageId)}
                                      bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                                      _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                                      color="red.300"
                                    >
                                      Delete Message
                                    </MenuItem>
                                  </>
                                )}
                              </MenuList>
                            </Menu>
                          </Box>
                        </Flex>

                        {isEditing ? (
                          <MessageInput
                            onSendMessage={(data) => handleEditMessage(messageId, data.content)}
                            currentChannel={currentChannel}
                            initialMessage={message.content}
                            placeholder="Edit your message..."
                            showAttachment={false}
                            onCancel={() => setEditingMessage(null)}
                            isEditing={true}
                            customStyles={{
                              container: {
                                bg: colorMode === 'dark' ? 'gray.700' : 'gray.100',
                                borderRadius: 'md',
                                p: 2
                              }
                            }}
                          />
                        ) : (
                          <Text color={colorMode === 'dark' ? 'white' : 'gray.800'} whiteSpace="pre-wrap">
                            {message.content}
                          </Text>
                        )}

                        {/* Thread Reply Count */}
                        {message.reply_count > 0 && (
                          <Button
                            size="xs"
                            variant="ghost"
                            leftIcon={<ChatIcon />}
                            mt={2}
                            onClick={() => {
                              setActiveThread(message);
                              setShowThreadPanel(true);
                            }}
                            color={colorMode === 'dark' ? 'blue.200' : 'blue.500'}
                            _hover={{
                              bg: colorMode === 'dark' ? 'whiteAlpha.200' : 'blue.50'
                            }}
                          >
                            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                          </Button>
                        )}
                      </Box>
                    </Flex>
                  </Box>
                );
              })}
              <div ref={messagesEndRef} style={{ height: 0 }} />
            </VStack>

            {/* Message Input */}
            <Box p={4} bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
              <MessageInput
                onSendMessage={handleSendMessage}
                currentChannel={currentChannel}
                placeholder="Type a message..."
                showAttachment={true}
              />
            </Box>
          </>
        )}

        {/* Thread Panel */}
        {showThreadPanel && activeThread && (
          <Box 
            w="40%"
            h="100vh"
            position="fixed"
            top={0}
            right={0}
            bg={colorMode === 'dark' ? 'gray.800' : 'white'}
            borderLeft="1px"
            borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
            zIndex={20}
          >
            <ThreadPanel
              parentMessage={activeThread}
              onClose={() => {
                setShowThreadPanel(false);
                setActiveThread(null);
                setShowAIComposer(false);
                setSelectedMessage(null);
              }}
              onSendReply={handleNewReply}
              currentChannel={currentChannel}
              showAIComposer={showAIComposer}
              selectedMessage={selectedMessage}
              onAIComposerClose={() => {
                setShowAIComposer(false);
                setSelectedMessage(null);
              }}
            />
          </Box>
        )}

        {/* AI Composer Modal */}
        {showAIComposer && selectedMessage && (
          <AutoReplyComposer
            message={selectedMessage}
            onSelectReply={handleAIReply}
            onClose={() => {
              setShowAIComposer(false);
              setSelectedMessage(null);
            }}
          />
        )}

        {/* Modals */}
        <CreateChannelModal 
          isOpen={showNewChannelModal} 
          onClose={() => setShowNewChannelModal(false)} 
        />
        
        <DirectMessage
          isOpen={isDirectMessageOpen}
          onClose={() => setIsDirectMessageOpen(false)}
          onSelect={handleDirectMessageSelect}
        />

        <UserProfile
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        <UserSettings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        <ChannelSettings 
          isOpen={showChannelSettings}
          onClose={() => setShowChannelSettings(false)}
          channel={currentChannel}
        />

        <NotesModal
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          channelId={currentChannel?.id || currentChannel?._id}
          channelName={currentChannel?.name}
          threadId={null}
        />
      </Flex>
    </Flex>
  );
} 