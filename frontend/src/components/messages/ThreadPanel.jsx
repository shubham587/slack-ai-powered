import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  IconButton,
  VStack,
  Avatar,
  Divider,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useToast,
  Button,
  Tooltip,
  useColorModeValue,
  useColorMode,
  Input,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { CloseIcon, EditIcon, DeleteIcon, ChatIcon } from '@chakra-ui/icons';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { AiOutlineRobot } from 'react-icons/ai';
import { FiFileText } from 'react-icons/fi';
import MessageInput from './MessageInput';
import AutoReplyComposer from '../ai/AutoReplyComposer';
import NotesModal from '../notes/NotesModal';
import { getSocket } from '../../socket';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';

const MIN_WIDTH = 400; // Minimum width in pixels
const MAX_WIDTH = 800; // Maximum width in pixels
const DEFAULT_WIDTH = 500; // Default width in pixels

const ThreadPanel = ({ 
  parentMessage, 
  onClose, 
  onSendReply,
  currentChannel,
  showAIComposer = false,
  selectedMessage = null,
  onAIComposerClose
}) => {
  const [replies, setReplies] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [internalSelectedMessage, setInternalSelectedMessage] = useState(null);
  const [internalShowAIComposer, setInternalShowAIComposer] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [messageInputValue, setMessageInputValue] = useState('');
  const toast = useToast();
  const currentUser = useSelector(selectUser);
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Debug log current user
  useEffect(() => {
    console.log('Thread Panel - Current user:', currentUser);
  }, [currentUser]);

  // Add debug logging for message ownership
  const isOwnMessage = (message) => {
    const isOwn = message.sender_id === currentUser?.id || message.sender_id === currentUser?._id;
    console.log('Thread Panel - Message ownership check:', {
      messageSenderId: message.sender_id,
      userId: currentUser?.id,
      userIdAlt: currentUser?._id,
      isOwn
    });
    return isOwn;
  };

  // Effect to handle channel changes
  useEffect(() => {
    if (!parentMessage) return;
    
    // Only close if the parent message exists and its channel doesn't match the current channel
    const parentChannelId = parentMessage.channel_id;
    const currentChannelId = currentChannel?._id;
    
    if (parentChannelId && currentChannelId && parentChannelId !== currentChannelId) {
      console.log('Thread channel mismatch:', { parentChannelId, currentChannelId });
      onClose();
    }
  }, [currentChannel?._id, parentMessage, onClose]);

  // Effect to handle suggested reply
  useEffect(() => {
    if (selectedMessage) {
      console.log('ThreadPanel - Selected message for reply:', selectedMessage);
      setInternalSelectedMessage({
        ...selectedMessage,
        useFullContext: selectedMessage.useFullContext === undefined ? true : selectedMessage.useFullContext
      });
    }
  }, [selectedMessage]);

  // Effect to handle socket events for replies and load initial replies
  useEffect(() => {
    if (!parentMessage) return;
    
    const messageId = parentMessage._id || parentMessage.id;
    console.log('ThreadPanel - Setting up socket listeners and loading replies for:', messageId);
    
    // Track if component is mounted
    let isMounted = true;
    
    // Load initial replies
    const loadInitialReplies = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${messageId}/replies`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load replies');
        }

        const data = await response.json();
        console.log('ThreadPanel - Received initial replies:', data);

        // Only update state if component is still mounted
        if (isMounted) {
          // Sort replies by creation date
          const sortedReplies = data.sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );

          console.log('ThreadPanel - Setting sorted replies:', sortedReplies);
          setReplies(sortedReplies);
        }
      } catch (error) {
        console.error('Error loading replies:', error);
        setError('Failed to load replies');
      } finally {
        setIsLoading(false);
      }
    };

    // Load initial replies
    loadInitialReplies();
    
    const socket = getSocket();
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    // Join thread room
    socket.emit('join_thread', { thread_id: messageId });
    console.log('Joined thread room:', messageId);

    // Handle new replies
    const handleNewReply = (data) => {
      console.log('ThreadPanel - Received new reply:', data);
      const parentId = data.parent_id;
      
      if (parentId === messageId) {
        setReplies(prev => {
          // Extract the actual reply object from the data
          const replyData = data.reply || data;
          
          // Check if reply already exists
          const replyId = replyData._id || replyData.id;
          const exists = prev.some(reply => (reply._id || reply.id) === replyId);
          
          if (exists) {
            console.log('Reply already exists:', replyId);
            return prev;
          }
          
          console.log('Adding new reply to thread');
          return [...prev, replyData].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
        });

        // Update parent message reply count
        if (onSendReply) {
          onSendReply({
            ...parentMessage,
            reply_count: (parentMessage.reply_count || 0) + 1
          });
        }
      }
    };

    // Subscribe to socket events
    socket.on('new_reply', handleNewReply);
    socket.on('message_created', handleNewReply); // Also handle message_created events

    // Cleanup
    return () => {
      isMounted = false;
      console.log('Cleaning up socket listeners for thread:', messageId);
      socket.off('new_reply', handleNewReply);
      socket.off('message_created', handleNewReply);
      socket.emit('leave_thread', { thread_id: messageId });
    };
  }, [parentMessage?._id || parentMessage?.id]);

  const handleSendReply = async (messageData) => {
    try {
      const messageId = parentMessage._id || parentMessage.id;
      console.log('Sending reply to message:', messageId, messageData);
      
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${messageId}/reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reply');
      }

      const newReply = await response.json();
      console.log('New reply from server:', newReply);

      // Clear replyingTo state after successful reply
      setReplyingTo(null);
      
      // Let the socket event handle adding the reply to the state
      // This ensures consistent handling of new replies
      
      // Call the parent handler if provided
      if (onSendReply) {
        onSendReply(newReply);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      throw error;
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Editing message:', messageId, 'with content:', newContent);
      
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
      console.log('Updated message response:', updatedMessage);
      
      // Update the message in state
      setReplies(prev => 
        prev.map(reply => 
          (reply._id === messageId || reply.id === messageId) ? updatedMessage : reply
        )
      );

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
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      console.log('Deleting message:', messageId);
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

      // Remove message from state, checking both _id and id fields
      setReplies(prev => prev.filter(reply => {
        const replyId = reply._id || reply.id;
        return replyId !== messageId;
      }));
      
      toast({
        title: 'Message deleted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });

      // Also notify parent component if provided
      if (onSendReply) {
        onSendReply({ type: 'delete', messageId });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAIReply = async (replyText) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/${parentMessage.id}/reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: replyText })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }

      // Let the socket event handle adding the reply to the state
      await response.json();
      
      // Update parent message and close composer
      onSendReply(parentMessage);
      onAIComposerClose();
      scrollToBottom();
    } catch (error) {
      console.error('Error sending AI reply:', error);
      toast({
        title: 'Error sending reply',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSuggestReply = (message) => {
    // For quick replies without context
    setInternalSelectedMessage({
      ...message,
      is_improvement: false,
      useFullContext: false,
      isQuickReply: true // New flag to indicate quick reply
    });
    setInternalShowAIComposer(true);
  };

  const handleSuggestContextualReply = (message) => {
    // For replies with full thread context
    setInternalSelectedMessage({
      ...message,
      is_improvement: false,
      useFullContext: true,
      isQuickReply: false
    });
    setInternalShowAIComposer(true);
  };

  // Add this new function to handle AI suggestion selection
  const handleAISuggestionSelect = (suggestion) => {
    console.log('Setting message input value to:', suggestion);
    setMessageInputValue(suggestion);
    if (internalShowAIComposer) {
      setInternalShowAIComposer(false);
      setInternalSelectedMessage(null);
    } else {
      onAIComposerClose();
    }
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

  const renderMessage = (message, isParent = false) => {
    const messageId = message._id || message.id;
    if (!messageId) {
      console.error('Message without ID:', message);
      return null;
    }

    const isEditing = editingMessage && (editingMessage._id === messageId || editingMessage.id === messageId);
    const isOwn = isOwnMessage(message);

    return (
      <Box
        key={`${isParent ? 'parent' : 'reply'}-${messageId}`}
        py={2}
        px={4}
        bg={isParent ? (colorMode === 'dark' ? 'gray.700' : 'gray.100') : 'transparent'}
        borderRadius="md"
        position="relative"
        role="group"
        _hover={{ bg: isParent ? (colorMode === 'dark' ? 'gray.600' : 'gray.200') : (colorMode === 'dark' ? 'gray.700' : 'gray.100') }}
      >
        <Flex gap={3}>
          <Avatar
            size="sm"
            name={message.username}
            src={message.avatar_url}
          />
          <Box flex="1">
            <Flex align="center" justify="space-between" mb={1}>
              <Flex align="center" gap={2}>
                <Text fontWeight="bold" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
                  {message.username}
                </Text>
                <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                  {formatTimestamp(message.created_at)}
                </Text>
              </Flex>
              
              {/* Context Menu */}
              <Box opacity="0" _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<BsThreeDotsVertical />}
                    variant="ghost"
                    size="sm"
                    color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
                    _hover={{ color: colorMode === 'dark' ? 'white' : 'gray.800' }}
                  />
                  <MenuList bg={colorMode === 'dark' ? 'gray.800' : 'white'} borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
                    {/* Copy Message option for all messages */}
                    <MenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                        toast({
                          title: 'Message copied',
                          status: 'success',
                          duration: 2000,
                          isClosable: true,
                        });
                      }}
                      bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                      _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                      color={colorMode === 'dark' ? 'white' : 'gray.800'}
                    >
                      Copy Message
                    </MenuItem>

                    {/* Suggest Reply option for other users' messages */}
                    {message.sender_id !== currentUser?.id && (
                      <MenuItem
                        icon={<AiOutlineRobot />}
                        onClick={() => {
                          setInternalSelectedMessage({
                            ...message,
                            isQuickReply: true,
                            useFullContext: false,
                            inThread: true
                          });
                          setInternalShowAIComposer(true);
                        }}
                        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                        _hover={{ bg: colorMode === 'dark' ? 'gray.600' : 'gray.100' }}
                        color={colorMode === 'dark' ? 'white' : 'gray.800'}
                      >
                        Suggest Reply
                      </MenuItem>
                    )}

                    {/* Edit and Delete options for own messages */}
                    {isOwn && !isParent && (
                      <>
                        <MenuItem
                          icon={<EditIcon />}
                          onClick={() => {
                            console.log('Setting editing message:', message);
                            setEditingMessage(message);
                          }}
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
          </Box>
        </Flex>
      </Box>
    );
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Flex
      direction="column"
      h="100vh"
      w="40%"
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      position="fixed"
      right={0}
      top={0}
      zIndex={20}
      borderLeft="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
    >
      {/* Header */}
      <Flex 
        p={4} 
        borderBottom="1px" 
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'} 
        align="center" 
        justify="space-between"
        bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
      >
        <Text fontSize="lg" fontWeight="semibold" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
          Thread
        </Text>
        <Flex gap={2}>
          <Tooltip label="Generate Notes">
            <IconButton
              icon={<FiFileText />}
              onClick={() => setShowNotesModal(true)}
              variant="ghost"
              colorScheme="blue"
              size="sm"
            />
          </Tooltip>
          <IconButton
            icon={<CloseIcon />}
            onClick={onClose}
            variant="ghost"
            size="sm"
            color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
            _hover={{ color: colorMode === 'dark' ? 'white' : 'gray.800', bg: colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.100' }}
          />
        </Flex>
      </Flex>

      {/* Messages Area */}
      <VStack spacing={4} align="stretch" flex="1" overflowY="auto" p={4} bg={colorMode === 'dark' ? 'gray.900' : 'white'} className="custom-scrollbar">
        {parentMessage && renderMessage(parentMessage, true)}
        
        {replies.length > 0 && (
          <>
            <Divider borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
            <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} fontSize="sm" px={4}>
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </Text>
          </>
        )}
        
        {replies.map((reply, index) => {
          const messageId = reply._id || reply.id;
          if (!messageId) {
            console.error('Reply without ID:', reply);
            return null;
          }
          return (
            <Box key={`reply-${messageId}-${index}`}>
              {renderMessage(reply)}
            </Box>
          );
        })}
        <div ref={messagesEndRef} />
      </VStack>

      {/* Message Input */}
      <Box 
        p={4} 
        borderTop="1px" 
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        maxH="300px"
        overflowY="auto"
      >
        <MessageInput
          onSendMessage={handleSendReply}
          currentChannel={currentChannel}
          placeholder="Reply in thread..."
          showAttachment={false}
          replyingTo={replyingTo}
          onCancel={() => setReplyingTo(null)}
          value={messageInputValue}
          onChange={setMessageInputValue}
          customStyles={{
            container: {
              bg: colorMode === 'dark' ? 'gray.700' : 'gray.100',
              borderRadius: 'md',
              p: 2,
              minH: '40px',
              maxH: '200px'
            },
            input: {
              color: colorMode === 'dark' ? 'white' : 'gray.800',
              _placeholder: { color: colorMode === 'dark' ? 'gray.400' : 'gray.500' }
            },
            sendButton: {
              colorScheme: 'blue',
              size: 'sm',
              px: 4
            },
            cancelButton: {
              variant: 'ghost',
              colorScheme: 'gray',
              size: 'sm'
            }
          }}
        />
      </Box>

      {/* AI Reply Composer Modal */}
      {(showAIComposer || internalShowAIComposer) && (selectedMessage || internalSelectedMessage) && (
        <AutoReplyComposer
          message={selectedMessage || internalSelectedMessage}
          threadContext={[parentMessage, ...replies].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          ).map(msg => ({
            content: msg.content,
            username: msg.username,
            created_at: msg.created_at,
            sender_id: msg.sender_id,
            id: msg._id || msg.id,
            channel_id: msg.channel_id,
            is_direct: msg.is_direct
          }))}
          onSelectReply={handleAISuggestionSelect}
          onClose={() => {
            if (internalShowAIComposer) {
              setInternalShowAIComposer(false);
              setInternalSelectedMessage(null);
            } else {
              onAIComposerClose();
            }
          }}
        />
      )}

      {/* Notes Modal */}
      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        channelId={currentChannel?._id}
        threadId={parentMessage?._id || parentMessage?.id}
        channelName={currentChannel?.name}
        threadTitle={parentMessage?.content}
      />
    </Flex>
  );
};

export default ThreadPanel; 