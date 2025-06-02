import React, { useRef, useEffect, useState } from 'react';
import {
  VStack,
  Box,
  Text,
  HStack,
  Avatar,
  useToast,
  Flex,
  IconButton,
  Grid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Tooltip,
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
} from '@chakra-ui/react';
import {
  AttachmentIcon,
  DownloadIcon,
  ChatIcon,
  SettingsIcon,
  AddIcon,
  SearchIcon,
  ChevronDownIcon,
  BellIcon,
  HamburgerIcon,
  CloseIcon,
  EditIcon,
  DeleteIcon,
} from '@chakra-ui/icons';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { AiFillPushpin, AiOutlinePushpin } from 'react-icons/ai';
import MessageInput from '../components/messages/MessageInput';
import { useDispatch, useSelector } from 'react-redux';
import { pinMessage, unpinMessage } from '../store/slices/channelsSlice';
import { selectUser } from '../store/slices/userSlice';
import { FiDownload } from 'react-icons/fi';
import { formatFileSize } from '../utils/formatFileSize';
import AutoReplyComposer from '../components/messages/AutoReplyComposer';
import ThreadPanel from '../components/messages/ThreadPanel';

const handleSendMessage = async (messageData, hasFile) => {
  if ((!messageData.content?.trim() && !hasFile) || !currentChannel?.id) {
    console.log('Validation failed:', {
      hasContent: Boolean(messageData.content?.trim()),
      hasFile,
      channelId: currentChannel?.id
    });
    return;
  }

  try {
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/messages/channel/${currentChannel.id}`;
    const token = localStorage.getItem('token');
    
    // Add detailed token debugging
    console.log('Token Debug:', {
      exists: Boolean(token),
      preview: token ? `${token.substring(0, 10)}...` : 'no token',
      length: token?.length || 0
    });
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Log request details
    console.log('Request Debug:', {
      url,
      hasFile,
      channelId: currentChannel.id,
      token: 'Bearer ' + token.substring(0, 10) + '...',
      contentType: hasFile ? 'multipart/form-data' : 'application/json',
      messageDataType: hasFile ? 'FormData' : 'JSON'
    });

    if (hasFile) {
      // Log FormData contents
      const formEntries = Array.from(messageData.entries()).map(([key, value]) => {
        if (value instanceof File) {
          return [key, { 
            name: value.name,
            type: value.type,
            size: value.size
          }];
        }
        return [key, value];
      });
      console.log('FormData Debug:', {
        entries: Object.fromEntries(formEntries),
        rawFormData: messageData
      });
    } else {
      console.log('Message Debug:', {
        content: messageData.content,
        rawMessageData: messageData
      });
    }
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...(hasFile ? {} : { 'Content-Type': 'application/json' })
    };

    // Log final request configuration
    console.log('Final Request Config:', {
      method: 'POST',
      headers,
      bodyType: hasFile ? 'FormData' : 'JSON',
      bodyPreview: hasFile ? 'FormData Object' : JSON.stringify(messageData).substring(0, 100)
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: hasFile ? messageData : JSON.stringify({ content: messageData.content }),
    });

    // Log response details
    console.log('Response Debug:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error Response Debug:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText || 'Unknown server error' };
      }
      
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Success Response:', data);
    return data;
  } catch (error) {
    console.error('Error Debug:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      messageData: hasFile ? {
        fileName: messageData.get('file')?.name,
        fileSize: messageData.get('file')?.size,
        content: messageData.get('content')
      } : messageData
    });
    throw error;
  }
};

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

const handleMessageClick = (message) => {
  // Debug message click
  console.log('Message Click Debug:', {
    hasFile: Boolean(message.file),
    fileInfo: message.file ? {
      filename: message.file.filename,
      size: message.file.size,
      download_url: message.file.download_url,
      fullMessage: message
    } : null
  });

  if (message.file && message.file.download_url) {
    // Remove any existing absolute URL to ensure we use our base URL
    const downloadUrl = message.file.download_url.replace(/^https?:\/\/[^/]+/i, '');
    console.log('Initiating download for:', downloadUrl);
    downloadFile(downloadUrl);
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
      throw new Error('Failed to delete message');
    }

    // Remove message from state
    setMessages(prev => prev.filter(msg => msg.id !== messageId));

    toast({
      title: 'Message deleted',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
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
  handleThreadOpen(message);
  // Wait a bit for the thread to open before showing AI composer
  setTimeout(() => {
    setSelectedMessage(message);
    setShowAIComposer(true);
  }, 100);
};

const Chat = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const toast = useToast();
  const channels = useSelector(state => state.channels.channels);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showPinnedFiles, setShowPinnedFiles] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [showAIComposer, setShowAIComposer] = useState(false);

  // Debug log current user
  useEffect(() => {
    console.log('Current user:', user);
  }, [user]);

  // Add debug logging for message ownership
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

  // Add effect to load pinned messages when channel changes
  useEffect(() => {
    if (currentChannel?.pinned_messages?.length > 0) {
      const pinnedMsgs = messages.filter(msg => 
        currentChannel.pinned_messages.includes(msg.id) && msg.file
      );
      setPinnedMessages(pinnedMsgs);
    } else {
      setPinnedMessages([]);
    }
  }, [currentChannel?.pinned_messages, messages]);

  const handlePinMessage = async (messageId) => {
    try {
      await dispatch(pinMessage({ channelId: currentChannel.id, messageId })).unwrap();
      toast({
        title: 'Message pinned',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
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
      await dispatch(unpinMessage({ channelId: currentChannel.id, messageId })).unwrap();
      toast({
        title: 'Message unpinned',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unpin message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Grid templateColumns="250px 1fr" h="100vh" bg="gray.900">
      {/* Existing sidebar */}
      
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
            </Flex>
            <HStack spacing={2}>
              <Tooltip label="Pinned Files" placement="bottom">
                <IconButton
                  icon={<Icon as={AiOutlinePushpin} />}
                  variant="ghost"
                  colorScheme="whiteAlpha"
                  size="sm"
                  onClick={() => setShowPinnedFiles(true)}
                />
              </Tooltip>
              {/* Existing buttons */}
            </HStack>
          </Flex>
        )}

        {/* Messages Area */}
        <Box flex="1" overflowY="auto" px={6} py={4}>
          {Array.isArray(messages) && messages.map((message) => {
            const isOwn = isOwnMessage(message);
            console.log('Rendering message:', {
              messageId: message.id,
              username: message.username,
              isPinned: currentChannel?.pinned_messages?.includes(message.id),
              isOwn,
              currentChannel: currentChannel?.id,
              pinnedMessages: currentChannel?.pinned_messages
            });

            return (
              <Box
                key={`message-${message.id}`}
                py={2}
                px={4}
                mx={-4}
                _hover={{ bg: 'gray.800' }}
                borderRadius="md"
                position="relative"
                role="group"
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
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </Text>
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
                            _hover={{ bg: "gray.700" }}
                            color="white"
                          >
                            {currentChannel?.pinned_messages?.includes(message.id) ? 'Unpin Message' : 'Pin Message'}
                          </MenuItem>
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
                            <MenuItem
                              icon={<AiOutlineRobot />}
                              onClick={() => handleSuggestReply(message)}
                              bg="gray.800"
                              _hover={{ bg: "gray.700" }}
                              color="white"
                            >
                              Suggest Reply
                            </MenuItem>
                          )}
                          {isOwn && (
                            <>
                              <MenuDivider borderColor="gray.700" />
                              <MenuItem
                                icon={<EditIcon />}
                                onClick={() => setEditingMessage(message)}
                                bg="gray.800"
                                _hover={{ bg: "gray.700" }}
                                color="white"
                              >
                                Edit Message
                              </MenuItem>
                              <MenuItem
                                icon={<DeleteIcon />}
                                onClick={() => handleDeleteMessage(message.id)}
                                bg="gray.800"
                                _hover={{ bg: "gray.700" }}
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
                        onClick={() => {
                          const downloadUrl = message.file.download_url.replace(/^https?:\/\/[^/]+/i, '');
                          downloadFile(downloadUrl);
                        }}
                        cursor="pointer"
                        _hover={{ bg: 'gray.600' }}
                      >
                        <Flex align="center" gap={3}>
                          <Icon as={AttachmentIcon} boxSize={5} color="blue.300" />
                          <Box flex="1" minW={0}>
                            <Text fontSize="sm" color="white" isTruncated>
                              {message.file.filename}
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                              {formatFileSize(message.file.size)}
                            </Text>
                          </Box>
                        </Flex>
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
          })}
          <div ref={messagesEndRef} />
        </Box>

        {/* Pinned Files Modal */}
        <Modal isOpen={showPinnedFiles} onClose={() => setShowPinnedFiles(false)} size="xl">
          <ModalOverlay />
          <ModalContent bg="gray.800">
            <ModalHeader borderBottom="1px" borderColor="gray.700" color="white">
              Pinned Files
            </ModalHeader>
            <ModalCloseButton color="gray.400" />
            <ModalBody py={6}>
              {pinnedMessages.length > 0 ? (
                <VStack spacing={4} align="stretch">
                  {pinnedMessages.map(message => (
                    <Box
                      key={message.id}
                      p={3}
                      bg="gray.700"
                      borderRadius="md"
                    >
                      <Flex align="center" gap={3}>
                        <Icon as={AttachmentIcon} boxSize={5} color="blue.300" />
                        <Box flex="1" minW={0}>
                          <Text fontSize="sm" color="white" isTruncated>
                            {message.file.filename}
                          </Text>
                          <HStack spacing={2}>
                            <Text fontSize="xs" color="gray.400">
                              {(message.file.size / 1024).toFixed(1)} KB
                            </Text>
                            <Text fontSize="xs" color="gray.400">•</Text>
                            <Text fontSize="xs" color="gray.400">
                              Pinned by {message.username}
                            </Text>
                          </HStack>
                        </Box>
                        <HStack>
                          <IconButton
                            icon={<Icon as={AiFillPushpin} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="green"
                            onClick={() => handleUnpinMessage(message.id)}
                            aria-label="Unpin file"
                          />
                        </HStack>
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text color="gray.400" textAlign="center">No pinned files in this channel</Text>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

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
            replyingTo={replyingTo}
            onCancel={() => setReplyingTo(null)}
          />
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

        {/* Existing modals */}
      </Flex>
    </Grid>
  );
};

export default Chat; 