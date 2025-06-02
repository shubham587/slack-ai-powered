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
  MenuDivider,
  useToast,
  Button,
  Tooltip,
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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const toast = useToast();
  const currentUser = useSelector(selectUser);

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
      // Ensure we preserve useFullContext flag
      setInternalSelectedMessage({
        ...selectedMessage,
        useFullContext: selectedMessage.useFullContext === undefined ? true : selectedMessage.useFullContext
      });
    }
  }, [selectedMessage]);

  // Separate effect for loading replies and socket handling
  useEffect(() => {
    if (!parentMessage) return;

    const messageId = parentMessage._id || parentMessage.id;
    console.log('ThreadPanel - Loading replies for:', {
      parentMessage,
      messageId,
      currentChannel
    });
    
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
        console.log('ThreadPanel - Received replies:', data);

        // Only update state if component is still mounted
        if (isMounted) {
          // Sort replies by creation date
          const sortedReplies = data.sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          );

          console.log('ThreadPanel - Setting sorted replies:', sortedReplies);
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

  const handleSelectAIReply = async (replyText) => {
    try {
      console.log('Sending AI reply in thread:', replyText);
      await handleSendReply({ content: replyText });
      
      // Clear replyingTo state after successful AI reply
      setReplyingTo(null);
      
      // Close the AI composer
      if (internalShowAIComposer) {
        setInternalShowAIComposer(false);
        setInternalSelectedMessage(null);
      } else {
        onAIComposerClose();
      }
      
      toast({
        title: 'Reply sent in thread',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error sending AI reply:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reply',
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
    // Ensure we have a valid ID by checking both _id and id fields
    const messageId = message._id || message.id;
    if (!messageId) {
      console.error('Message without ID:', message);
      return null; // Skip rendering messages without IDs
    }

    const isEditing = editingMessage && (editingMessage._id === messageId || editingMessage.id === messageId);
    const isOwn = isOwnMessage(message);
    
    console.log('Thread Panel - Rendering message:', {
      messageId,
      username: message.username,
      isParent,
      isOwn,
      isEditing
    });

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
                    color="gray.400"
                    _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
                  />
                  <MenuList bg="gray.800" borderColor="gray.700">
                    {/* AI suggestion options for other users' messages */}
                    {!isOwn && (
                      <>
                        <MenuItem
                          icon={<AiOutlineRobot />}
                          onClick={() => handleSuggestReply(message)}
                          bg="gray.800"
                          _hover={{ bg: 'gray.700' }}
                          color="white"
                        >
                          Quick Reply
                        </MenuItem>
                        <MenuItem
                          icon={<AiOutlineRobot />}
                          onClick={() => handleSuggestContextualReply(message)}
                          bg="gray.800"
                          _hover={{ bg: 'gray.700' }}
                          color="white"
                        >
                          Contextual Reply
                        </MenuItem>
                      </>
                    )}

                    {/* Edit and Delete options for own messages */}
                    {isOwn && !isParent && (
                      <>
                        <MenuDivider borderColor="gray.700" />
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

  // Handle mouse move during resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      // Calculate new width based on mouse position
      const newWidth = window.innerWidth - e.clientX;
      
      // Clamp width between min and max values
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <Flex
      direction="column"
      h="100vh"
      w={`${width}px`}
      bg="gray.800"
      position="fixed"
      right={0}
      top={0}
      zIndex={20}
      borderLeft="1px solid"
      borderColor="gray.700"
      transition="width 0.2s"
      _hover={{
        '& .resize-handle': {
          opacity: 1
        }
      }}
    >
      {/* Resize Handle */}
      <Box
        className="resize-handle"
        position="absolute"
        left={-2}
        top={0}
        w={4}
        h="100%"
        cursor="ew-resize"
        opacity={0}
        _hover={{ opacity: 1 }}
        transition="opacity 0.2s"
        onMouseDown={() => setIsResizing(true)}
      >
        <Box
          w={1}
          h="100%"
          bg="blue.500"
          mx="auto"
          opacity={isResizing ? 1 : 0.5}
        />
      </Box>

      {/* Header */}
      <Flex 
        p={4} 
        borderBottom="1px" 
        borderColor="gray.700" 
        align="center" 
        justify="space-between"
      >
        <Text fontSize="lg" fontWeight="semibold" color="white">
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
            colorScheme="whiteAlpha"
            size="sm"
          />
        </Flex>
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

      {/* Message Input Area */}
      <Box 
        p={4} 
        borderTop="1px" 
        borderColor="gray.700"
        bg="gray.800"
        position="relative"
      >
        {/* Quick Reply Button */}
        <Flex justify="center" mb={4}>
          <Tooltip
            label={`AI will analyze the entire thread (${replies.length + 1} messages) to generate a contextually relevant reply`}
            placement="top"
            hasArrow
          >
            <Button
              leftIcon={<AiOutlineRobot />}
              onClick={() => {
                // Create message object with thread context
                const messageWithContext = {
                  ...parentMessage,
                  is_improvement: false,
                  useFullContext: true
                };
                
                console.log('ThreadPanel - AI Reply Button Clicked:', {
                  messageWithContext,
                  parentMessage,
                  replies,
                  fullContext: [parentMessage, ...replies].map(msg => ({
                    id: msg._id || msg.id,
                    content: msg.content,
                    username: msg.username,
                    created_at: msg.created_at
                  }))
                });
                
                setInternalSelectedMessage(messageWithContext);
                setInternalShowAIComposer(true);
              }}
              variant="outline"
              colorScheme="blue"
              size="sm"
              width="auto"
              display="flex"
              alignItems="center"
              gap={2}
            >
              <Box>
                <Text>Get AI Reply Suggestion</Text>
                {/* <Text fontSize="xs" color="blue.200">Using {replies.length + 1} messages as context</Text> */}
              </Box>
            </Button>
          </Tooltip>
        </Flex>

        <MessageInput
          onSendMessage={handleSendReply}
          currentChannel={currentChannel}
          placeholder="Reply in thread..."
          showAttachment={false}
          replyingTo={replyingTo}
          onCancel={() => setReplyingTo(null)}
          customStyles={{
            container: {
              bg: 'gray.700',
              borderRadius: 'md',
              p: 2
            },
            input: {
              color: 'white',
              _placeholder: { color: 'gray.400' }
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
          threadContext={(() => {
            // Get all messages in chronological order, including the parent message
            const allMessages = [parentMessage, ...replies].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            ).map(msg => ({
              content: msg.content,
              username: msg.username,
              created_at: msg.created_at,
              sender_id: msg.sender_id,
              id: msg._id || msg.id,
              channel_id: msg.channel_id,
              is_direct: msg.is_direct
            }));
            
            // Log the full context details
            console.log('ThreadPanel - Full Context Details:', {
              contextLength: allMessages.length,
              fullContextList: allMessages,
              parentMessage: {
                id: parentMessage._id || parentMessage.id,
                content: parentMessage.content,
                username: parentMessage.username,
                created_at: parentMessage.created_at,
                sender_id: parentMessage.sender_id
              },
              repliesCount: replies.length,
              targetMessage: selectedMessage || internalSelectedMessage
            });
            
            return allMessages;
          })()}
          onSelectReply={handleSelectAIReply}
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
        channelId={currentChannel?.id}
        threadId={parentMessage?._id || parentMessage?.id}
        channelName={currentChannel?.name}
        threadTitle={parentMessage?.content}
      />
    </Flex>
  );
};

export default ThreadPanel; 