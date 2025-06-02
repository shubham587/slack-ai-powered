import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  Box,
  Text,
  Button,
  Flex,
  Select,
  IconButton,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { CloseIcon, RepeatIcon } from '@chakra-ui/icons';

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' }
];

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' }
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const AutoReplyComposer = ({ 
  message,           // Current message to reply to or improve
  threadContext = [], // Array of previous messages in the thread (optional)
  onSelectReply,     // Callback when a reply is selected
  onClose           // Callback to close the composer
}) => {
  const dispatch = useDispatch();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTone, setSelectedTone] = useState('professional');
  const [selectedLength, setSelectedLength] = useState('medium');
  const [retryCount, setRetryCount] = useState(0);

  const generateSuggestions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Debug logs
      console.log('Original message object:', message);
      console.log('Is improvement flag:', message.is_improvement);

      // Create a more detailed context object
      const requestBody = {
        message: typeof message === 'string' ? 
          { content: message, is_improvement: message.is_improvement || false } : 
          { 
            ...message,
            content: message.content,
            is_improvement: message.is_improvement || false // Use the passed flag instead of forcing true
          },
        threadContext: [],
        tone: selectedTone,
        length: selectedLength
      };

      console.log('Sending request to AI:', JSON.stringify(requestBody, null, 2)); // Detailed debug log

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/ai/suggest-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.message || 'Failed to generate suggestions');
      }

      const data = await response.json();
      console.log('API Response:', data); // Debug log
      
      if (data.status === 'success' && data.suggestions) {
        setSuggestions(data.suggestions);
      } else {
        throw new Error(data.message || 'Failed to generate suggestions');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setError('Failed to generate suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract conversation topic
  const extractConversationTopic = (context) => {
    if (!context.length) return '';
    // Get the first message as it usually sets the topic
    const firstMessage = context[0];
    return firstMessage.content;
  };

  const handleSelectReply = (suggestion) => {
    onSelectReply(suggestion.text);
    onClose();
    
    toast({
      title: 'Reply selected',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <Box className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <Flex p={4} borderBottom="1px" borderColor="gray.700" justify="space-between" align="center">
          <Text fontSize="lg" fontWeight="semibold" color="white">
            {message.is_improvement ? 'AI Message Improvements' : 'AI Reply Suggestions'}
          </Text>
          <IconButton
            icon={<CloseIcon />}
            size="sm"
            variant="ghost"
            colorScheme="whiteAlpha"
            onClick={onClose}
          />
        </Flex>

        {/* Message being replied to or improved */}
        <Box p={4} borderBottom="1px" borderColor="gray.700" bg="gray.750">
          <Flex align="center" gap={2} mb={2}>
            <Text fontSize="sm" color="gray.400">
              {message.is_improvement ? 'Improving:' : 'Replying to:'}
            </Text>
            {!message.draft && (
              <Text fontSize="sm" color="blue.300">
                {new Date(message.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </Text>
            )}
          </Flex>
          <Box 
            bg="gray.700" 
            p={3} 
            borderRadius="md"
            borderLeft="4px solid"
            borderLeftColor="blue.400"
          >
            <Text color="white" whiteSpace="pre-wrap">
              {typeof message === 'string' ? message : message.content}
            </Text>
          </Box>
        </Box>

        {/* Options */}
        <Box p={4} borderBottom="1px" borderColor="gray.700">
          <Flex gap={4} mb={4}>
            {/* Tone Selection */}
            <Box flex="1">
              <Text mb={1} fontSize="sm" fontWeight="medium" color="gray.300">
                Tone
              </Text>
              <Select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value)}
                bg="gray.700"
                borderColor="gray.600"
                color="white"
                _hover={{ borderColor: 'gray.500' }}
              >
                {TONE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Box>

            {/* Length Selection */}
            <Box flex="1">
              <Text mb={1} fontSize="sm" fontWeight="medium" color="gray.300">
                Length
              </Text>
              <Select
                value={selectedLength}
                onChange={(e) => setSelectedLength(e.target.value)}
                bg="gray.700"
                borderColor="gray.600"
                color="white"
                _hover={{ borderColor: 'gray.500' }}
              >
                {LENGTH_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Box>
          </Flex>

          <Button
            onClick={generateSuggestions}
            isLoading={isLoading}
            width="full"
            colorScheme="blue"
            loadingText="Generating..."
          >
            {message.is_improvement ? 'Generate Improvements' : 'Generate Suggestions'}
          </Button>
        </Box>

        {/* Suggestions */}
        <Box p={4} maxH="96" overflowY="auto">
          {error && (
            <Alert status="error" mb={4} borderRadius="md">
              <AlertIcon />
              <Box flex="1">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription display="block">
                  {error}
                </AlertDescription>
              </Box>
              <IconButton
                icon={<RepeatIcon />}
                onClick={generateSuggestions}
                variant="ghost"
                colorScheme="red"
                size="sm"
                ml={2}
                isLoading={isLoading}
                aria-label="Retry"
              />
            </Alert>
          )}

          {suggestions.length > 0 ? (
            <Box className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <Box
                  key={index}
                  borderWidth="1px"
                  borderColor="gray.700"
                  rounded="md"
                  p={4}
                  _hover={{ borderColor: 'blue.500' }}
                  cursor="pointer"
                  onClick={() => handleSelectReply(suggestion)}
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <Flex gap={2}>
                      <Text
                        px={2}
                        py={1}
                        bg="gray.700"
                        rounded="md"
                        fontSize="xs"
                        color="gray.300"
                      >
                        {suggestion.tone}
                      </Text>
                      <Text
                        px={2}
                        py={1}
                        bg="gray.700"
                        rounded="md"
                        fontSize="xs"
                        color="gray.300"
                      >
                        {suggestion.length}
                      </Text>
                    </Flex>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectReply(suggestion);
                      }}
                    >
                      Use This
                    </Button>
                  </Flex>
                  <Text color="gray.100" whiteSpace="pre-wrap">
                    {suggestion.text}
                  </Text>
                </Box>
              ))}
            </Box>
          ) : !isLoading && !error && (
            <Text textAlign="center" color="gray.400" py={8}>
              Click "{message.is_improvement ? 'Generate Improvements' : 'Generate Suggestions'}" to get AI-powered {message.is_improvement ? 'message improvements' : 'reply suggestions'}
            </Text>
          )}
        </Box>
      </Box>
    </div>
  );
};

export default AutoReplyComposer; 