import React, { useState, useEffect } from 'react';
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
  useToast,
} from '@chakra-ui/react';
import { CloseIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { BsThreeDotsVertical } from 'react-icons/bs';
import MessageInput from './MessageInput';
import { getSocket } from '../../socket';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';

const ThreadPanel = ({ 
  parentMessage, 
  onClose, 
  onSendReply,
  currentChannel,
}) => {
  const [replies, setReplies] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const toast = useToast();
  const currentUser = useSelector(selectUser);

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

  // Separate effect for loading replies and socket handling
  useEffect(() => {
    if (!parentMessage) return;

    const messageId = parentMessage._id || parentMessage.id;
    console.log('Parent message:', parentMessage);
    console.log('Message ID for thread:', messageId);
    
    // Track if component is mounted
    let isMounted = true;
    
    // Load replies only once when parent message changes
    const loadInitialReplies = async () => {
      try {
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
        console.log('Received replies from server:', data);

        // Only update state if component is still mounted
        if (isMounted) {
          // Sort replies by creation date
          const sortedReplies = data.sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );

          console.log('Setting sorted replies:', sortedReplies);
          setReplies(sortedReplies);

          // Update parent message reply count to match actual number of replies
          if (onSendReply && parentMessage) {
            const updatedParentMessage = {
              ...parentMessage,
              reply_count: sortedReplies.length
            };
            onSendReply(updatedParentMessage);
          }
        }
      } catch (error) {
        console.error('Error loading replies:', error);
      }
    };

    loadInitialReplies();
    
    // Get socket instance
    const socket = getSocket();
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    // Join both thread-specific room and channel room
    socket.emit('join_thread', { thread_id: messageId });
    socket.emit('join', { channel: parentMessage.channel_id });
    console.log('Joined thread room:', messageId, 'and channel:', parentMessage.channel_id);

    // Handle new replies
    const handleNewReply = (data) => {
      console.log('Received socket event - new reply:', data);
      const parentId = data.parent_id || data.message_id;
      const replyData = data.reply || data;
      
      if (parentId === messageId) {
        setReplies(prev => {
          // Check if reply already exists
          const replyId = replyData._id || replyData.id;
          const exists = prev.some(reply => (reply._id || reply.id) === replyId);
          
          if (exists) {
            console.log('Reply already exists:', replyId);
            return prev;
          }
          
          console.log('Adding new reply to state:', replyData);
          const newReplies = [...prev, replyData].sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );
          return newReplies;
        });
      }
    };

    // Handle message updates
    const handleMessageUpdated = (data) => {
      console.log('Received socket event - message updated:', data);
      const updatedMessageId = data._id || data.id;
      const messageId = parentMessage._id || parentMessage.id;
      
      // If this is the parent message being updated
      if (updatedMessageId === messageId && onSendReply) {
        onSendReply(data);
      }
      
      // Update reply if it exists in the thread
      setReplies(prev => prev.map(reply => {
        const replyId = reply._id || reply.id;
        return replyId === updatedMessageId ? data : reply;
      }));
    };

    // Handle message deletions
    const handleMessageDeleted = (data) => {
      console.log('Received socket event - message deleted:', data);
      const deletedMessageId = data.message_id;
      
      setReplies(prev => {
        const newReplies = prev.filter(reply => {
          const replyId = reply._id || reply.id;
          return replyId !== deletedMessageId;
        });
        
        // Update parent message reply count
        if (onSendReply && parentMessage) {
          const updatedParentMessage = {
            ...parentMessage,
            reply_count: newReplies.length
          };
          onSendReply(updatedParentMessage);
        }
        
        return newReplies;
      });
    };

    // Subscribe to socket events
    socket.on('new_reply', handleNewReply);
    socket.on('message_created', handleNewReply); // Also listen for general messages
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);

    // Cleanup
    return () => {
      isMounted = false;
      console.log('Cleaning up socket listeners');
      socket.off('new_reply', handleNewReply);
      socket.off('message_created', handleNewReply);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
      socket.emit('leave_thread', { thread_id: messageId });
      socket.emit('leave', { channel: parentMessage.channel_id });
    };
  }, [parentMessage?._id || parentMessage?.id]); // Only depend on the message ID

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

  const renderMessage = (message, isParent = false) => {
    // Ensure we have a valid ID by checking both _id and id fields
    const messageId = message._id || message.id;
    if (!messageId) {
      console.error('Message without ID:', message);
      return null; // Skip rendering messages without IDs
    }

    const isEditing = editingMessage && (editingMessage._id === messageId || editingMessage.id === messageId);
    const isOwnMessage = message.sender_id === currentUser?.id || message.sender_id === currentUser?._id;
    
    return (
      <Box
        key={`${isParent ? 'parent' : 'reply'}-${messageId}`}
        py={2}
        px={4}
        bg={isParent ? 'gray.700' : 'transparent'}
        borderRadius="md"
        position="relative"
        role="group"
        _hover={{ bg: 'gray.750' }}
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
                <Text fontWeight="bold" color="white">
                  {message.username}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  {new Date(message.created_at).toLocaleTimeString()}
                </Text>
              </Flex>
              
              {/* Context Menu */}
              {isOwnMessage && !isParent && (
                <Box opacity="0" _groupHover={{ opacity: 1 }} transition="opacity 0.2s">
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<BsThreeDotsVertical />}
                      variant="ghost"
                      size="sm"
                      color="gray.400"
                      _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
                    />
                    <MenuList bg="gray.800" borderColor="gray.700">
                      <MenuItem
                        icon={<EditIcon />}
                        onClick={() => {
                          console.log('Setting editing message:', message);
                          setEditingMessage(message);
                        }}
                        bg="gray.800"
                        _hover={{ bg: 'gray.700' }}
                        color="white"
                      >
                        Edit Message
                      </MenuItem>
                      <MenuItem
                        icon={<DeleteIcon />}
                        onClick={() => handleDeleteMessage(messageId)}
                        bg="gray.800"
                        _hover={{ bg: 'gray.700' }}
                        color="red.300"
                      >
                        Delete Message
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Box>
              )}
            </Flex>
            
            {isEditing ? (
              <MessageInput
                onSendMessage={(data) => handleEditMessage(messageId, data.content)}
                currentChannel={currentChannel}
                initialMessage={message.content}
                placeholder="Edit your message..."
                showAttachment={false}
                onCancel={() => setEditingMessage(null)}
              />
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

  return (
    <Flex direction="column" h="100%" bg="gray.800">
      <Flex 
        h="64px" 
        px={4} 
        align="center" 
        justify="space-between" 
        borderBottom="1px" 
        borderColor="gray.700"
      >
        <Text color="white" fontWeight="medium">Thread</Text>
        <IconButton
          icon={<CloseIcon />}
          size="sm"
          variant="ghost"
          colorScheme="whiteAlpha"
          onClick={onClose}
        />
      </Flex>

      <VStack spacing={4} align="stretch" flex="1" overflowY="auto" p={4}>
        {parentMessage && renderMessage(parentMessage, true)}
        
        {replies.length > 0 && (
          <>
            <Divider borderColor="gray.700" />
            <Text color="gray.400" fontSize="sm" px={4}>
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
      </VStack>

      <Box p={4} borderTop="1px" borderColor="gray.700">
        <MessageInput
          onSendMessage={handleSendReply}
          currentChannel={currentChannel}
          placeholder="Reply in thread..."
          showAttachment={false}
        />
      </Box>
    </Flex>
  );
};

export default ThreadPanel; 