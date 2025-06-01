import React, { useRef, useEffect } from 'react';
import {
  VStack,
  Box,
  Text,
  HStack,
  Avatar,
  useToast,
} from '@chakra-ui/react';
import { AttachmentIcon } from '@chakra-ui/icons';
import MessageInput from '../components/messages/MessageInput';

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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

return (
  <VStack spacing={4} h="100%" w="100%">
    <Box
      flex="1"
      w="100%"
      overflowY="auto"
      p={4}
      bg="gray.800"
      borderRadius="md"
    >
      {messages.map((message) => (
        <Box
          key={message.id}
          mb={4}
          onClick={() => handleMessageClick(message)}
          cursor={message.file ? 'pointer' : 'default'}
          _hover={message.file ? { bg: 'gray.700' } : {}}
          p={2}
          borderRadius="md"
        >
          <HStack spacing={2} alignItems="flex-start">
            <Avatar size="sm" name={message.username} />
            <Box>
              <Text color="gray.300" fontSize="sm">
                {message.username}
                <Text as="span" ml={2} color="gray.500" fontSize="xs">
                  {new Date(message.created_at).toLocaleString()}
                </Text>
              </Text>
              {message.file ? (
                <VStack align="start" spacing={1}>
                  <Text color="white">{message.content}</Text>
                  <HStack>
                    <AttachmentIcon />
                    <Text color="blue.300">
                      {message.file.filename} ({formatFileSize(message.file.size)})
                    </Text>
                  </HStack>
                </VStack>
              ) : (
                <Text color="white">{message.content}</Text>
              )}
            </Box>
          </HStack>
        </Box>
      ))}
      <div ref={messagesEndRef} />
    </Box>
    <MessageInput
      onSendMessage={handleSendMessage}
      currentChannel={currentChannel}
      handleTyping={handleTyping}
    />
  </VStack>
); 