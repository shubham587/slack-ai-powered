import React, { useState, useEffect } from 'react';
import {
  Box,
  Input,
  IconButton,
  HStack,
  useToast,
  Collapse,
  Button,
  VStack,
  Text,
  Flex,
} from '@chakra-ui/react';
import { AttachmentIcon, SmallCloseIcon } from '@chakra-ui/icons';
import { FiSend } from 'react-icons/fi';
import FileUpload from './FileUpload';

const MessageInput = ({ onSendMessage, currentChannel, handleTyping }) => {
  const [message, setMessage] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const toast = useToast();

  // Add useEffect to clear file state when channel changes
  useEffect(() => {
    // Clear file state when changing channels
    setSelectedFile(null);
    setShowFileUpload(false);
    setMessage('');
  }, [currentChannel?.id]); // Only trigger when channel ID changes

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() && !selectedFile) return;
    
    try {
      // Debug current state
      console.log('MessageInput State Debug:', {
        hasMessage: Boolean(message.trim()),
        messageLength: message.trim().length,
        hasFile: Boolean(selectedFile),
        fileDetails: selectedFile ? {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          lastModified: selectedFile.lastModified
        } : null
      });

      // Create FormData if there's a file
      if (selectedFile) {
        const formData = new FormData();
        
        // Always append the file first
        formData.append('file', selectedFile);
        
        // Always append content, even if empty (backend expects it)
        formData.append('content', message.trim() || '');
        
        // Log FormData contents for debugging
        console.log('FormData Debug:', {
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          message: message.trim() || null,
          formDataEntries: Array.from(formData.entries()).map(([key, value]) => {
            if (value instanceof File) {
              return [key, `File: ${value.name} (${value.size} bytes)`];
            }
            return [key, value];
          })
        });
        
        await onSendMessage(formData, true);
      } else {
        console.log('Message Only Debug:', {
          content: message.trim(),
          length: message.trim().length
        });
        
        await onSendMessage({ content: message.trim() }, false);
      }
      
      // Clear inputs after successful send
      setMessage('');
      setSelectedFile(null);
      setShowFileUpload(false);
    } catch (error) {
      console.error('MessageInput Error Debug:', {
        error,
        errorType: error.constructor.name,
        errorMessage: error.message,
        stack: error.stack,
        selectedFile: selectedFile ? {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size
        } : null,
        message: message.trim() || null
      });
      
      toast({
        title: 'Error sending message',
        description: error.message || 'Failed to send message',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setShowFileUpload(false); // Hide upload area after selection
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
  };

  return (
    <Box>
      <Collapse in={showFileUpload}>
        <Box mb={4}>
          <FileUpload
            key={currentChannel?.id || 'no-channel'}
            onFileSelect={handleFileSelect}
            onRemove={handleFileRemove}
          />
        </Box>
      </Collapse>
      
      <form onSubmit={handleSubmit}>
        <VStack spacing={3}>
          {selectedFile && (
            <Flex
              w="100%"
              bg="gray.700"
              p={2}
              borderRadius="md"
              alignItems="center"
              justifyContent="space-between"
            >
              <Text fontSize="sm" color="gray.300">
                Attached: {selectedFile.name}
              </Text>
              <IconButton
                icon={<SmallCloseIcon />}
                size="sm"
                variant="ghost"
                onClick={handleFileRemove}
                aria-label="Remove file"
              />
            </Flex>
          )}
          
          <HStack width="100%" spacing={2}>
            <IconButton
              icon={<AttachmentIcon />}
              variant="ghost"
              colorScheme="whiteAlpha"
              onClick={() => setShowFileUpload(!showFileUpload)}
              aria-label="Attach file"
            />
            <Input
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
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
            <Button
              colorScheme="blue"
              type="submit"
              disabled={!currentChannel || (!message.trim() && !selectedFile)}
              leftIcon={<FiSend />}
            >
              Send
            </Button>
          </HStack>
        </VStack>
      </form>
    </Box>
  );
};

export default MessageInput; 