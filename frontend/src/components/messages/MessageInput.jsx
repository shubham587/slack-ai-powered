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

const MessageInput = ({ 
  onSendMessage, 
  currentChannel, 
  handleTyping,
  placeholder,
  showAttachment = true,
  initialMessage = '',
  onCancel
}) => {
  const [message, setMessage] = useState(initialMessage);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const toast = useToast();

  // Update message when initialMessage changes
  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  // Add useEffect to clear file state when channel changes
  useEffect(() => {
    // Clear file state when changing channels
    setSelectedFile(null);
    setShowFileUpload(false);
    if (!initialMessage) {
      setMessage('');
    }
  }, [currentChannel?.id, initialMessage]); // Only trigger when channel ID changes

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() && !selectedFile) return;
    
    try {
      if (selectedFile) {
        // For file uploads, send the file and content
        await onSendMessage({
          file: selectedFile,
          content: message.trim()
        }, true);
      } else {
        // For text-only messages
        await onSendMessage({
          content: message.trim()
        }, false);
      }
      
      // Clear inputs after successful send
      setMessage('');
      setSelectedFile(null);
      setShowFileUpload(false);
    } catch (error) {
      console.error('Error sending message:', error);
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
    <Box w="100%" maxW="100%">
      <Collapse in={showFileUpload}>
        <Box mb={4}>
          <FileUpload
            key={currentChannel?.id || 'no-channel'}
            onFileSelect={handleFileSelect}
            onRemove={handleFileRemove}
          />
        </Box>
      </Collapse>
      
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <VStack spacing={3} w="100%">
          {selectedFile && (
            <Flex
              w="100%"
              bg="gray.700"
              p={2}
              borderRadius="md"
              alignItems="center"
              justifyContent="space-between"
            >
              <Text fontSize="sm" color="gray.300" isTruncated maxW="calc(100% - 40px)">
                Attached: {selectedFile.name}
              </Text>
              <IconButton
                icon={<SmallCloseIcon />}
                size="sm"
                variant="ghost"
                onClick={handleFileRemove}
                aria-label="Remove file"
                flexShrink={0}
              />
            </Flex>
          )}
          
          <HStack width="100%" spacing={2}>
            {showAttachment && (
              <IconButton
                icon={<AttachmentIcon />}
                variant="ghost"
                colorScheme="whiteAlpha"
                onClick={() => setShowFileUpload(!showFileUpload)}
                aria-label="Attach file"
                flexShrink={0}
              />
            )}
            <Input
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping?.();
              }}
              placeholder={placeholder || (currentChannel ? `Message #${currentChannel.name}` : 'Select a channel to start messaging')}
              size="lg"
              bg="white"
              color="gray.800"
              border="1px"
              borderColor="gray.300"
              _hover={{ borderColor: 'gray.400' }}
              _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
              _placeholder={{ color: 'gray.500' }}
              disabled={!currentChannel}
              flex={1}
              minW={0}
            />
            <Button
              colorScheme="blue"
              type="submit"
              disabled={!currentChannel || (!message.trim() && !selectedFile)}
              leftIcon={<FiSend />}
              flexShrink={0}
            >
              Send
            </Button>
            {onCancel && (
              <Button
                variant="ghost"
                onClick={() => {
                  setMessage('');
                  onCancel();
                }}
                flexShrink={0}
              >
                Cancel
              </Button>
            )}
          </HStack>
        </VStack>
      </form>
    </Box>
  );
};

export default MessageInput; 