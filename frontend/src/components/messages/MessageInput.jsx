import React, { useState, useEffect } from 'react';
import {
  Box,
  Textarea,
  IconButton,
  HStack,
  useToast,
  Collapse,
  Button,
  VStack,
  Text,
  Flex,
  Input,
} from '@chakra-ui/react';
import { AttachmentIcon, SmallCloseIcon, CloseIcon } from '@chakra-ui/icons';
import { FiSend } from 'react-icons/fi';
import { AiOutlineRobot } from 'react-icons/ai';
import FileUpload from './FileUpload';
import AutoReplyComposer from '../ai/AutoReplyComposer';
import MessageToneAnalyzer from '../ai/MessageToneAnalyzer';

const MessageInput = ({ 
  onSendMessage, 
  currentChannel, 
  placeholder = 'Type a message...', 
  showAttachment = true,
  initialMessage = '',
  onCancel,
  replyingTo,
  customStyles = {}
}) => {
  const [message, setMessage] = useState(initialMessage);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const toast = useToast();
  const fileInputRef = React.useRef(null);
  const typingTimeoutRef = React.useRef(null);

  // Update message when initialMessage changes
  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  // Add useEffect to clear file state when channel changes
  useEffect(() => {
    // Clear file state when changing channels
    setSelectedFile(null);
    setShowFileUpload(false);
    setShowAiSuggestions(false);
    setReplyToMessage(null);
    setAnalysis(null);
    if (!initialMessage) {
      setMessage('');
    }
  }, [currentChannel?.id, initialMessage]); // Only trigger when channel ID changes

  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    setIsTyping(true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleAnalysisComplete = (analysisData) => {
    setAnalysis(analysisData);
    
    // Show warning for aggressive tone
    if (analysisData.tone === 'aggressive') {
      toast({
        title: 'Message Tone Warning',
        description: 'Your message may come across as aggressive. Consider revising.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
    }
  };

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

  const handleSelectReply = (replyText) => {
    setMessage(replyText);
    setShowAiSuggestions(false);
  };

  const handleAiClick = () => {
    // If we have a message typed, use it for improvement
    if (message.trim()) {
      setReplyToMessage({
        content: message.trim(),
        created_at: new Date().toISOString(),
        draft: true,
        is_improvement: true, // Flag to indicate this is for improvement
        useFullContext: false // No thread context needed for direct improvements
      });
      setShowAiSuggestions(true);
    } else {
      toast({
        title: 'Please enter a message first',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSend = () => {
    handleSubmit(new Event('submit'));
  };

  return (
    <Box {...customStyles.container}>
      {replyingTo && (
        <Flex 
          align="center" 
          justify="space-between" 
          mb={2} 
          p={2} 
          bg="gray.700" 
          borderRadius="md"
        >
          <Text fontSize="sm" color="gray.400">
            Replying to {replyingTo.username}
          </Text>
          <IconButton
            icon={<CloseIcon />}
            size="xs"
            variant="ghost"
            onClick={() => onCancel()}
          />
        </Flex>
      )}
      
      <Flex direction="column" gap={2}>
        <Flex gap={2}>
          {showAttachment && (
            <IconButton
              icon={<AttachmentIcon />}
              onClick={handleAttachmentClick}
              variant="ghost"
              colorScheme="whiteAlpha"
              size="md"
              {...customStyles.attachButton}
            />
          )}
          
          <Input
            type="file"
            ref={fileInputRef}
            display="none"
            onChange={handleFileChange}
          />
          
          <Box flex="1" position="relative">
            <Textarea
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              resize="none"
              rows={1}
              bg="transparent"
              border="none"
              _focus={{ border: 'none', boxShadow: 'none' }}
              pr="100px"
              {...customStyles.input}
            />
            
            {/* Tone Analysis */}
            <Box 
              position="absolute" 
              bottom={2} 
              right={2}
              zIndex={2}
              bg="gray.800"
              borderRadius="md"
              p={1}
            >
              <MessageToneAnalyzer
                message={message}
                channelType={currentChannel?.type}
                onAnalysisComplete={handleAnalysisComplete}
                isTyping={isTyping}
              />
            </Box>
          </Box>
          
          <IconButton
            icon={<AiOutlineRobot />}
            onClick={handleAiClick}
            isDisabled={!message.trim()}
            variant="ghost"
            colorScheme="whiteAlpha"
            size="md"
            {...customStyles.aiButton}
          />
          
          <Button
            onClick={handleSend}
            isDisabled={!message.trim() && !selectedFile}
            colorScheme="blue"
            {...customStyles.sendButton}
          >
            Send
          </Button>
          
          {onCancel && (
            <Button
              onClick={() => {
                setMessage('');  // Clear the message
                setSelectedFile(null);  // Clear any selected file
                setShowFileUpload(false);  // Hide file upload if shown
                setShowAiSuggestions(false);  // Hide AI suggestions if shown
                onCancel();  // Call the parent's onCancel handler
              }}
              {...customStyles.cancelButton}
            >
              Cancel
            </Button>
          )}
        </Flex>

        {/* Analysis Improvements */}
        {analysis && analysis.improvements.length > 0 && (
          <Collapse in={!isTyping}>
            <Box
              mt={2}
              p={2}
              bg="gray.700"
              borderRadius="md"
              borderLeft="4px solid"
              borderLeftColor="blue.400"
            >
              <Text fontSize="sm" color="gray.300" mb={1}>
                Suggested Improvements:
              </Text>
              <VStack align="stretch" spacing={1}>
                {analysis.improvements.map((improvement, index) => (
                  <Text key={index} fontSize="sm" color="gray.100">
                    • {improvement}
                  </Text>
                ))}
              </VStack>
            </Box>
          </Collapse>
        )}
      </Flex>

      {selectedFile && (
        <Flex 
          mt={2} 
          p={2} 
          bg="gray.700" 
          borderRadius="md" 
          align="center" 
          justify="space-between"
        >
          <Text fontSize="sm" color="gray.300" isTruncated>
            {selectedFile.name}
          </Text>
          <IconButton
            icon={<CloseIcon />}
            size="xs"
            variant="ghost"
            onClick={() => setSelectedFile(null)}
          />
        </Flex>
      )}

      {showAiSuggestions && replyToMessage && (
        <AutoReplyComposer
          message={{
            ...replyToMessage,
            is_improvement: true // Ensure improvement mode is set
          }}
          threadContext={[]} // No thread context needed for improvements
          onSelectReply={handleSelectReply}
          onClose={() => {
            setShowAiSuggestions(false);
            setReplyToMessage(null);
          }}
        />
      )}
    </Box>
  );
};

export default MessageInput; 