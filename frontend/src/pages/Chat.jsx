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
import { fetchChannels, setActiveChannel, createChannel } from '../store/slices/channelsSlice';
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

const Chat = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const channels = useSelector(selectChannels);
  
  // State declarations
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

  const messagesEndRef = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();

  // Memoized selector for messages
  const selectMessagesForChannel = useMemo(
    () => createSelector(
      [(state) => state.messages.messages, () => currentChannel?.id],
      (messages, channelId) => channelId ? messages[channelId] || [] : []
    ),
    [currentChannel?.id]
  );

  // Use memoized selector
  const messages = useSelector(selectMessagesForChannel);

  // Update filtered messages when messages or search term changes
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

  // Memoized pinned messages
  const currentPinnedMessages = useMemo(() => {
    if (currentChannel?.pinned_messages?.length > 0 && messages.length > 0) {
      return messages.filter(msg => 
        currentChannel.pinned_messages.includes(msg.id)
      );
    }
    return [];
  }, [currentChannel?.pinned_messages, messages]);

  useEffect(() => {
    setPinnedMessages(currentPinnedMessages);
  }, [currentPinnedMessages]);

  // Memoized filtered channels
  const currentFilteredChannels = useMemo(() => {
    const channelsArray = channels.filter(channel => !channel.is_direct);
    if (!searchTerm.trim()) {
      return channelsArray;
    }
    const searchTermLower = searchTerm.toLowerCase();
    return channelsArray.filter(channel => 
      channel.name.toLowerCase().includes(searchTermLower) ||
      channel.description?.toLowerCase().includes(searchTermLower)
    );
  }, [channels, searchTerm]);

  useEffect(() => {
    setFilteredChannels(currentFilteredChannels);
  }, [currentFilteredChannels]);

  // Memoized filtered direct messages
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

  useEffect(() => {
    setFilteredDirectMessages(currentFilteredDirectMessages);
  }, [currentFilteredDirectMessages]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
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

      const sortedMessages = data
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(msg => ({
          ...msg,
          reply_count: msg.reply_count || 0,
          is_direct: currentChannel?.is_direct || false
        }));

      dispatch(setMessages({ channelId, messages: sortedMessages }));
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      dispatch(setError(error.message));
      dispatch(setMessages({ channelId, messages: [] }));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, currentChannel?.is_direct, scrollToBottom]);

  // Selector with safe null check
  const isMessagesLoading = useSelector(state => state.messages.loading);

  // Update filtered data when search terms change
  useEffect(() => {
    const channelsArray = Object.values(channels).filter(channel => !channel.is_direct);
    if (searchTerm.trim() === '') {
      setFilteredChannels(channelsArray);
    } else {
      const filtered = channelsArray.filter(channel => 
        channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        channel.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredChannels(filtered);
    }
  }, [channels, searchTerm]);

  useEffect(() => {
    if (userSearchTerm.trim() === '') {
      setFilteredDirectMessages(directMessages);
    } else {
      const searchTermLower = userSearchTerm.toLowerCase();
      const filtered = directMessages.filter(dm => 
        dm.user.username.toLowerCase().includes(searchTermLower) ||
        dm.user.display_name?.toLowerCase().includes(searchTermLower)
      );
      setFilteredDirectMessages(filtered);
    }
  }, [directMessages, userSearchTerm]);

  // Update pinned messages
  useEffect(() => {
    if (currentChannel?.pinned_messages?.length > 0 && messages.length > 0) {
      const pinned = messages.filter(msg => 
        currentChannel.pinned_messages.includes(msg.id)
      );
      setPinnedMessages(pinned);
    } else {
      setPinnedMessages([]);
    }
  }, [currentChannel?.pinned_messages, messages]);

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

  // Initialize socket and data
  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      if (!mounted) return;

      try {
        setIsLoading(true);
        await loadChannels();
        await loadRecentDirectMessages();
      } catch (error) {
        console.error('Error initializing data:', error);
      } finally {
        if (mounted) {
        setIsLoading(false);
        }
      }
    };

    const token = localStorage.getItem('token');
    if (token) {
      initializeSocket(token);
    }

    const socket = getSocket();
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    const userId = user?.id;
    if (userId) {
        socket.emit('join_user_room', { user_id: userId });
    }

    initializeData();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [user?.id]);

  // Handle channel selection
  const handleChannelSelect = useCallback((channel) => {
    console.log('Selecting channel:', channel);
    
    // Leave current channel if any
    if (currentChannel?.id) {
      leaveChannel(currentChannel.id);
    }
    
    // Always close thread when switching channels
    setShowThreadPanel(false);
    setActiveThread(null);
    setShowAIComposer(false);
    setSelectedMessage(null);
    
    setCurrentChannel(channel);
    setSelectedDmId(null); // Clear DM selection when selecting a channel
    
    if (channel?.id) {
      // Join new channel
      joinChannel(channel.id);
      loadMessages(channel.id);
    }
  }, [currentChannel?.id, loadMessages]);

  // Load messages when channel changes
  useEffect(() => {
    if (currentChannel?.id) {
      loadMessages(currentChannel.id);
    } else {
      dispatch(setMessages({ channelId: null, messages: [] }));
    }
  }, [currentChannel?.id, loadMessages, dispatch]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Message search effect
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
  }, [messageSearchTerm, messages]);

  // User search effect
  useEffect(() => {
    if (userSearchTerm.trim() === '') {
      setFilteredDirectMessages(directMessages);
    } else {
      const searchTermLower = userSearchTerm.toLowerCase();
      const filtered = directMessages.filter(dm => 
        dm.user.username.toLowerCase().includes(searchTermLower) ||
        dm.user.display_name?.toLowerCase().includes(searchTermLower)
      );
      setFilteredDirectMessages(filtered);
    }
  }, [directMessages, userSearchTerm]);

  // Memoize handleDirectMessageSelect
  const handleDirectMessageSelect = useCallback(async (user, existingChannelId = null) => {
    try {
      const token = localStorage.getItem('token');
      let channelId = existingChannelId;
      let messages = [];

      // Leave current channel if any
      if (currentChannel?.id) {
        leaveChannel(currentChannel.id);
      }

    if (!channelId) {
        // If no existing channel ID, create/get one
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
      } else {
        // If we have a channel ID, just load messages for that channel
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
        name: user.display_name || user.username,
        is_direct: true,
        members: [user.id],
        avatar_url: user.avatar_url,
        display_name: user.display_name || user.username,
        description: `Direct message with ${user.display_name || user.username}`,
        type: 'direct'
      };

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
      
      // Join the DM channel
      joinChannel(channelId);

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

  const loadChannels = async () => {
    try {
      setIsLoading(true);
      await dispatch(fetchChannels()).unwrap();
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading channels:', error);
      setIsLoading(false);
    }
  };

  const joinChannel = (channelId) => {
    console.log('Joining channel:', channelId);
    const socket = getSocket();
    socket.emit('join', { channel: channelId });
  };

  const handleSendMessage = async (messageData, hasFile) => {
    if ((!messageData.content?.trim() && !hasFile) || !currentChannel?.id) return;

    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/channel/${currentChannel.id}`;
      const token = localStorage.getItem('token');
      
      let response;
      
      if (hasFile) {
        // Handle file upload with FormData
        const formData = new FormData();
        formData.append('file', messageData.file);
        formData.append('content', messageData.content || '');
        
        response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        // Handle text-only message
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: messageData.content
          })
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errorData.error || 'Failed to send message');
      }
      
      const data = await response.json();
      
      // Immediately update local state
      const newMessage = {
        ...data,
        reply_count: data.reply_count || 0,
        is_direct: currentChannel.is_direct || false
      };
      
      dispatch(setMessages({ channelId: currentChannel.id, messages: [...messages, newMessage] }));
      
      // Scroll to bottom immediately
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      // Update last message in directMessages list if it's a DM
      if (currentChannel.is_direct) {
        setDirectMessages(prev => 
          prev.map(dm => 
            dm.channel_id === currentChannel.id 
              ? { ...dm, last_message: newMessage }
              : dm
          )
        );
      }
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
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
          dispatch(setMessages({ channelId: currentChannel?.id, messages: messages.filter(msg => msg.id !== messageId) }));
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
        dispatch(setMessages({ channelId: currentChannel?.id, messages: messages.map(msg => 
          msg.id === messageId ? { ...msg, content: content } : msg
        ) }));
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
          dispatch(setMessages({ channelId: currentChannel?.id, messages: messages.filter(msg => msg.id !== messageId) }));
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
        dispatch(setMessages({ channelId: currentChannel?.id, messages: messages.filter(msg => msg.id !== messageId) }));
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

  const handlePinMessage = async (messageId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/channels/${currentChannel.id}/pin/${messageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to pin message');
      }

      const updatedChannel = await response.json();
      setCurrentChannel(updatedChannel);
      
      toast({
        title: 'Message pinned',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error pinning message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to pin message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleUnpinMessage = async (messageId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/channels/${currentChannel.id}/unpin/${messageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to unpin message');
      }

      const updatedChannel = await response.json();
      setCurrentChannel(updatedChannel);
      
      toast({
        title: 'Message unpinned',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error unpinning message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to unpin message',
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

  // Add socket event listener for DM updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleDirectMessage = (data) => {
      // Update messages if we're in the same DM channel
      if (currentChannel?.is_direct && data.channel_id === currentChannel.id) {
        dispatch(setMessages({ channelId: currentChannel.id, messages: [...messages, data] }));
        scrollToBottom();
      }

      // Update the direct messages list
      setDirectMessages(prev => {
        const otherUserId = data.sender_id === user?.id ? data.recipient_id : data.sender_id;
        return prev.map(dm => 
          dm.user.id === otherUserId
            ? { ...dm, last_message: data }
            : dm
        );
      });
    };

    socket.on('new_direct_message', handleDirectMessage);

    return () => {
      socket.off('new_direct_message', handleDirectMessage);
    };
  }, [currentChannel, user, messages, dispatch]);

  // Add downloadFile function
  const downloadFile = async (fileUrl) => {
    try {
      const token = localStorage.getItem('token');
      
      // Debug token information
      console.log('Download Token Debug:', {
        exists: Boolean(token),
        preview: token ? `${token.substring(0, 10)}...` : 'no token',
        fileUrl
      });

      if (!token) {
        throw new Error('No authentication token found');
      }

      // Determine if the URL is absolute or relative
      const isAbsoluteUrl = fileUrl.startsWith('http://') || fileUrl.startsWith('https://');
      const fullUrl = isAbsoluteUrl ? fileUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${fileUrl}`;

      // Debug request configuration
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      console.log('Download Request Debug:', {
        originalUrl: fileUrl,
        fullUrl,
        isAbsoluteUrl,
        headers,
        token: `Bearer ${token.substring(0, 10)}...`
      });

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      // Debug response
      console.log('Download Response Debug:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download Error Debug:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          requestHeaders: headers,
          url: fullUrl
        });
        throw new Error(errorText || 'Failed to download file');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Debug download information
      console.log('Download Info Debug:', {
        blobType: blob.type,
        blobSize: blob.size,
        downloadUrl: downloadUrl.substring(0, 50) + '...',
        contentDisposition: response.headers.get('content-disposition')
      });

      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or fallback to the URL
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/["']/g, '') // Remove quotes if present
        : fileUrl.split('/').pop() || 'download';
      
      link.download = filename;
      
      // Debug download link
      console.log('Download Link Debug:', {
        href: downloadUrl.substring(0, 50) + '...',
        filename,
        contentDisposition
      });

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download Error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      toast({
        title: 'Download Error',
        description: error.message || 'Failed to download file',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Add this function to handle thread opening
  const handleThreadOpen = (message) => {
    // Ensure the message has the current channel ID and type
    const messageWithChannel = {
      ...message,
      channel_id: currentChannel.id,
      is_direct: currentChannel.is_direct || false
    };
    setActiveThread(messageWithChannel);
    setShowThreadPanel(true);
  };

  const handleSuggestReply = (message) => {
    // First ensure thread is open
    const messageWithChannel = {
      ...message,
      channel_id: currentChannel.id,
      is_direct: currentChannel.is_direct || false,
      is_improvement: false, // This is a reply, not an improvement
      useFullContext: true // Use full thread context
    };
    setActiveThread(messageWithChannel);
    setShowThreadPanel(true);

    // Wait a bit for the thread to open before showing AI composer
    setTimeout(() => {
      setSelectedMessage(messageWithChannel);
      setShowAIComposer(true);
    }, 100);
  };

  const handleSuggestReplyWithContext = async (message) => {
    // First ensure thread is open
    const messageWithChannel = {
      ...message,
      channel_id: currentChannel.id,
      is_direct: currentChannel.is_direct || false,
      is_improvement: false, // This is a reply, not an improvement
      useFullContext: true // Use full thread context
    };
    setActiveThread(messageWithChannel);
    setShowThreadPanel(true);

    // Wait a bit for the thread to open and load replies before showing AI composer
    setTimeout(() => {
      setSelectedMessage(messageWithChannel);
      setShowAIComposer(true);
    }, 100);
  };

  // Update the handleNewReply function to immediately update the UI
  const handleNewReply = (reply) => {
    const parentId = reply.parent_id;
    if (!parentId) return;

    // Immediately update the parent message's reply count
    dispatch(setMessages({ channelId: currentChannel?.id, messages: messages.map(msg => 
      msg.id === parentId
        ? {
            ...msg,
            reply_count: (msg.reply_count || 0) + 1,
            is_direct: currentChannel?.is_direct || false
          }
        : msg
    ) }));

    // If this is a DM, update the directMessages list
    if (currentChannel?.is_direct) {
      setDirectMessages(prev => 
        prev.map(dm => 
          dm.channel_id === currentChannel.id
            ? {
                ...dm,
                last_message: {
                  ...dm.last_message,
                  reply_count: ((dm.last_message?.reply_count || 0) + 1)
                }
              }
            : dm
        )
      );
    }
  };

  const isOwnMessage = (message) => {
    const isOwn = message.sender_id === user?.id || message.sender_id === user?._id;
    console.log('Message ownership check:', {
      messageSenderId: message.sender_id,
      userId: user?.id,
      userIdAlt: user?._id,
      isOwn
    });
    return isOwn;
  };

  const formatTimestamp = (timestamp) => {
    // Create a date object from the UTC timestamp
    const date = new Date(timestamp);
    
    // Convert to IST by adding 5 hours and 30 minutes
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    
    return istDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Update the renderMessage function to include a download button for files
  const renderMessage = (message, isPinned = false) => {
    const isOwn = isOwnMessage(message);

    return (
      <Box
        key={`message-${message.id}-${isPinned ? 'pinned' : 'regular'}`}
        py={2}
        px={4}
        mx={-4}
        bg={isPinned ? 'gray.800' : 'transparent'}
        _hover={{ bg: isPinned ? 'gray.700' : 'gray.800' }}
        borderRadius="md"
        role="group"
        position="relative"
        borderLeft={currentChannel?.pinned_messages?.includes(message.id) ? '4px solid' : 'none'}
        borderLeftColor={currentChannel?.pinned_messages?.includes(message.id) ? 'blue.400' : 'transparent'}
      >
        <Flex gap={3}>
          <Avatar
            size="sm"
            name={message.username}
            src={message.avatar_url}
          />
          <Box flex="1" minW={0}>
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={2}>
                <Text fontWeight="bold" color="white">
                  {message.username}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  {formatTimestamp(message.created_at)}
                </Text>
                {currentChannel?.pinned_messages?.includes(message.id) && (
                  <Flex align="center" gap={1}>
                    <Icon as={AiFillPushpin} color="blue.400" boxSize={3} />
                    <Text fontSize="xs" color="blue.400">Pinned</Text>
                  </Flex>
                )}
                {message.reply_count > 0 && (
                  <Text 
                    fontSize="xs" 
                    color="blue.300" 
                    cursor="pointer"
                    onClick={() => handleThreadOpen(message)}
                  >
                    {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                  </Text>
                )}
              </Flex>
              <Menu>
                <MenuButton
                  as={IconButton}
                  icon={<BsThreeDotsVertical />}
                  variant="ghost"
                  size="xs"
                  color="gray.400"
                  opacity="0"
                  _groupHover={{ opacity: 1 }}
                  _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
                />
                <MenuList bg="gray.800" borderColor="gray.700">
                  <MenuItem
                    icon={<ChatIcon />}
                    onClick={() => handleThreadOpen(message)}
                    bg="gray.800"
                    _hover={{ bg: "gray.700" }}
                    color="white"
                  >
                    Reply in Thread
                  </MenuItem>
                  {!isOwn && (
                    <>
                      <MenuItem
                        icon={<AiOutlineRobot />}
                        onClick={() => handleSuggestReply(message)}
                        bg="gray.800"
                        _hover={{ bg: "gray.700" }}
                        color="white"
                      >
                        Quick Reply Suggestion
                      </MenuItem>
                    </>
                  )}
                  <MenuItem
                    icon={currentChannel?.pinned_messages?.includes(message.id) ? 
                      <AiFillPushpin /> : <AiOutlinePushpin />
                    }
                    onClick={() => {
                      if (currentChannel?.pinned_messages?.includes(message.id)) {
                        handleUnpinMessage(message.id);
                      } else {
                        handlePinMessage(message.id);
                      }
                    }}
                    bg="gray.800"
                    _hover={{ bg: 'gray.700' }}
                    color="white"
                  >
                    {currentChannel?.pinned_messages?.includes(message.id) ? 'Unpin Message' : 'Pin Message'}
                  </MenuItem>
                  {message.sender_id === user?.id && (
                    <>
                      <MenuDivider borderColor="gray.700" />
                      <MenuItem
                        icon={<EditIcon />}
                        onClick={() => setEditingMessage(message)}
                        bg="gray.800"
                        _hover={{ bg: 'gray.700' }}
                        color="white"
                      >
                        Edit Message
                      </MenuItem>
                      <MenuItem
                        icon={<DeleteIcon />}
                        onClick={() => handleDeleteMessage(message.id)}
                        bg="gray.800"
                        _hover={{ bg: 'gray.700' }}
                        color="red.300"
                      >
                        Delete Message
                      </MenuItem>
                    </>
                  )}
                </MenuList>
              </Menu>
            </Flex>
            {message.file ? (
              <Box
                mt={2}
                p={3}
                bg="gray.700"
                borderRadius="md"
                maxW="300px"
              >
                <VStack spacing={2} align="stretch">
                  <Flex align="center" gap={3}>
                    <Icon as={AttachmentIcon} boxSize={5} color="blue.300" />
                    <Box flex="1" minW={0}>
                      <Text fontSize="sm" color="white" isTruncated>
                        {message.file.filename}
                      </Text>
                      <Text fontSize="xs" color="gray.400">
                        {(message.file.size / 1024).toFixed(1)} KB
                      </Text>
                    </Box>
                  </Flex>
                  <Flex justify="flex-end" gap={2}>
                    <Button
                      size="sm"
                      leftIcon={<DownloadIcon />}
                      onClick={() => downloadFile(message.file.download_url)}
                      variant="ghost"
                      colorScheme="blue"
                    >
                      Download
                    </Button>
                  </Flex>
                </VStack>
              </Box>
            ) : (
              <Text color="gray.100" whiteSpace="pre-wrap">
                {message.content}
              </Text>
            )}
          </Box>
        </Flex>
      </Box>
    );
  };

  const handleSelectAIReply = (replyText) => {
    handleSendMessage({ content: replyText });
    setShowAIComposer(false);
    setSelectedMessage(null);
  };

  return (
    <Grid 
      templateColumns={{ base: "1fr", md: "250px 1fr" }} 
      h="100vh" 
      w="100vw"
      maxW="100vw"
      maxH="100vh"
      overflow="hidden"
      bg="gray.900"
      position="fixed"
      top="0"
      left="0"
    >
      {/* Sidebar */}
      <Box 
        bg="gray.800" 
        borderRight="1px" 
        borderColor="gray.700" 
        overflow="hidden" 
        display={{ base: showSidebar ? 'flex' : 'none', md: 'flex' }}
        flexDirection="column"
        w={{ base: "100%", md: "250px" }}
        minW={{ base: "100%", md: "250px" }}
        position={{ base: "absolute", md: "relative" }}
        zIndex={{ base: 10, md: 1 }}
        h="100%"
      >
        {/* Add mobile close button */}
        <IconButton
          icon={<CloseIcon />}
          display={{ base: 'block', md: 'none' }}
          position="absolute"
          right={2}
          top={2}
          size="sm"
          onClick={() => setShowSidebar(false)}
          zIndex={2}
        />
        
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              {filteredChannels.map((channel, index) => (
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

            {/* Add user search box */}
            <Box mb={4}>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Search users..."
                  bg="gray.700"
                  border="1px"
                  borderColor="gray.600"
                  _placeholder={{ color: 'gray.400' }}
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                />
              </InputGroup>
            </Box>

            <Box>
              {filteredDirectMessages.map((dm) => (
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
                  bg={selectedDmId === dm.channel_id ? 'blue.600' : 'transparent'}
                  _hover={{ bg: selectedDmId === dm.channel_id ? 'blue.700' : 'gray.700' }}
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

        {/* Add LogoutButton at the bottom of sidebar */}
        <Box position="absolute" bottom={4} left={4} width="calc(100% - 32px)">
          <LogoutButton />
        </Box>
      </Box>

      {/* Main Chat Area */}
      <Flex 
        direction="column" 
        bg="gray.900" 
        overflow="hidden"
        w="100%"
        h="100%"
        position="relative"
      >
        {/* Mobile menu button */}
        <IconButton
          icon={<HamburgerIcon />}
          display={{ base: 'block', md: 'none' }}
          position="absolute"
          left={4}
          top={4}
          size="sm"
          onClick={() => setShowSidebar(true)}
          zIndex={2}
        />

        {currentChannel ? (
          <>
        {/* Channel Header */}
          <Flex
            h="64px"
            px={6}
            align="center"
            justify="space-between"
            borderBottom="1px"
            borderColor="gray.700"
            bg="gray.800"
              w="100%"
          >
              <Flex align="center" gap={4} flex={1}>
              <Box>
                <Flex align="center" gap={2}>
                    <Text color="gray.400" fontSize="lg">#</Text>
                    <Text color="white" fontWeight="medium" fontSize="lg">
                    {currentChannel.name}
                  </Text>
                </Flex>
                {currentChannel.description && (
                    <Text color="gray.400" fontSize="sm">
                    {currentChannel.description}
                  </Text>
                )}
              </Box>
                
                {/* Add search box */}
                <Box flex={1} maxW="400px" ml={4}>
                  <InputGroup size="sm">
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      value={messageSearchTerm}
                      onChange={(e) => setMessageSearchTerm(e.target.value)}
                      placeholder="Search messages..."
                      bg="gray.700"
                      border="1px"
                      borderColor="gray.600"
                      _placeholder={{ color: 'gray.400' }}
                      _hover={{ borderColor: 'gray.500' }}
                      _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                    />
                  </InputGroup>
              </Box>
            </Flex>

            <HStack spacing={2}>
              <Tooltip label="Generate Channel Notes">
                <IconButton
                  icon={<FiFileText />}
                  variant="ghost"
                  colorScheme="blue"
                  size="sm"
                  onClick={() => setShowNotesModal(true)}
                />
              </Tooltip>
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

        {/* Messages Area */}
            <Flex flex="1" overflow="hidden" maxW="100%">
              <Box flex="1" display="flex" flexDirection="column" minW={0} maxW="100%">
            {/* Messages List */}
            <Box 
              flex="1" 
              overflowY="auto" 
              px={6} 
              py={4} 
              className="custom-scrollbar"
                  maxW="100%"
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
                    {/* Pinned Messages Section */}
                    {pinnedMessages.length > 0 && (
                      <Box mb={6} bg="gray.800" p={4} borderRadius="md" position="sticky" top={0} zIndex={1}>
                        <Flex align="center" gap={2} mb={4}>
                          <Icon as={AiFillPushpin} color="blue.400" />
                          <Text color="white" fontWeight="medium">Pinned Messages</Text>
                          <Text color="gray.400" fontSize="sm">({pinnedMessages.length})</Text>
                        </Flex>
                        <VStack spacing={2} align="stretch">
                          {pinnedMessages.map(message => (
                            <Box
                              key={`pinned-${message.id}`}
                              p={2}
                    borderRadius="md"
                              bg="gray.700"
                              borderLeft="4px solid"
                              borderLeftColor="blue.400"
                  >
                              <Flex gap={3}>
                      <Avatar
                        size="sm"
                        name={message.username}
                        src={message.avatar_url}
                      />
                                <Box flex="1" minW={0}>
                                  <Flex align="center" gap={2}>
                                    <Text fontWeight="bold" color="white">
                            {message.username}
                          </Text>
                                    <Text fontSize="xs" color="gray.400">
                                      {formatTimestamp(message.created_at)}
                          </Text>
                        </Flex>
                                  {message.file ? (
                                    <Box
                                      mt={2}
                                      p={2}
                                      bg="gray.600"
                                      borderRadius="md"
                                      maxW="300px"
                                    >
                                      <VStack spacing={2} align="stretch">
                                        <Flex align="center" gap={3}>
                                          <Icon as={AttachmentIcon} boxSize={4} color="blue.300" />
                                          <Box flex="1" minW={0}>
                                            <Text fontSize="sm" color="white" isTruncated>
                                              {message.file.filename}
                                            </Text>
                                            <Text fontSize="xs" color="gray.400">
                                              {(message.file.size / 1024).toFixed(1)} KB
                                            </Text>
                                          </Box>
                                        </Flex>
                                        <Button
                              size="sm"
                                          leftIcon={<DownloadIcon />}
                                          onClick={() => downloadFile(message.file.download_url)}
                                          variant="ghost"
                                          colorScheme="blue"
                                        >
                                          Download
                                        </Button>
                                      </VStack>
                                    </Box>
                                  ) : (
                                    <Text color="gray.100" whiteSpace="pre-wrap">
                            {message.content}
                          </Text>
                        )}
                      </Box>
                    </Flex>
                  </Box>
                ))}
                        </VStack>
                      </Box>
                    )}
                    
                    <Box flex="1" />
                    {/* Regular Messages */}
                    {filteredMessages.map(message => renderMessage(message))}
                <div ref={messagesEndRef} />
              </Box>
            </Box>

            {/* Message Input */}
                <Box 
                  key="message-input-container" 
                  px={6} 
                  py={4} 
                  borderTop="1px" 
                  borderColor="gray.700"
                  maxW="100%"
                >
                  <MessageInput
                    onSendMessage={handleSendMessage}
                    currentChannel={currentChannel}
                    handleTyping={handleTyping}
                  />
            </Box>
          </Box>

          {/* Thread Panel */}
          {showThreadPanel && (
                <Box 
                  w={{ base: "100%", lg: "400px" }}
                  minW={{ base: "100%", lg: "400px" }}
                  borderLeft="1px" 
                  borderColor="gray.700" 
                  bg="gray.800"
                  position={{ base: "absolute", lg: "relative" }}
                  right={0}
                  top={0}
                  h="100%"
                  zIndex={5}
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
        </Flex>
          </>
        ) : (
          <WelcomeView />
        )}
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

      {/* AI Composer */}
      {showAIComposer && selectedMessage && !showThreadPanel && (
        <AutoReplyComposer
          message={selectedMessage}
          onSelectReply={handleSelectAIReply}
          onClose={() => {
            setShowAIComposer(false);
            setSelectedMessage(null);
          }}
        />
      )}

      {/* Notes Modal */}
      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        channelId={currentChannel?.id}
        channelName={currentChannel?.name}
      />
    </Grid>
  );
};

export default Chat; 