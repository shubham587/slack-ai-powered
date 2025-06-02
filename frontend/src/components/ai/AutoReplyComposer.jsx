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
  VStack,
  Spinner,
} from '@chakra-ui/react';
import { CloseIcon, RepeatIcon, WarningIcon } from '@chakra-ui/icons';

// Error types for better error handling
const ERROR_TYPES = {
  NETWORK: 'network',
  API: 'api',
  RATE_LIMIT: 'rate_limit',
  TOKEN: 'token',
  SERVER: 'server',
  UNKNOWN: 'unknown'
};

const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: 'Network error. Please check your connection.',
  [ERROR_TYPES.API]: 'Failed to get AI suggestions.',
  [ERROR_TYPES.RATE_LIMIT]: 'Too many requests. Please wait a moment.',
  [ERROR_TYPES.TOKEN]: 'Authentication error. Please try logging in again.',
  [ERROR_TYPES.SERVER]: 'Server error. Please try again later.',
  [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred.'
};

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
  const [errorType, setErrorType] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTone, setSelectedTone] = useState('professional');
  const [selectedLength, setSelectedLength] = useState('medium');
  const [retryCount, setRetryCount] = useState(0);

  const determineErrorType = (error) => {
    if (!error) return ERROR_TYPES.UNKNOWN;
    
    if (!navigator.onLine) return ERROR_TYPES.NETWORK;
    
    if (error.message?.includes('Failed to fetch') || 
        error.message?.includes('Network Error')) {
      return ERROR_TYPES.NETWORK;
    }
    
    if (error.response) {
      switch (error.response.status) {
        case 401:
        case 403:
          return ERROR_TYPES.TOKEN;
        case 429:
          return ERROR_TYPES.RATE_LIMIT;
        case 500:
        case 502:
        case 503:
        case 504:
          return ERROR_TYPES.SERVER;
        default:
          return ERROR_TYPES.API;
      }
    }
    
    return ERROR_TYPES.UNKNOWN;
  };

  const handleError = (error) => {
    console.error('AI Suggestion Error:', error);
    
    const type = determineErrorType(error);
    setErrorType(type);
    setError(ERROR_MESSAGES[type]);
    
    // Show toast for network and token errors
    if (type === ERROR_TYPES.NETWORK || type === ERROR_TYPES.TOKEN) {
      toast({
        title: 'Error',
        description: ERROR_MESSAGES[type],
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    
    // Auto-retry for network and server errors
    if ((type === ERROR_TYPES.NETWORK || type === ERROR_TYPES.SERVER) && 
        retryCount < MAX_RETRIES) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchSuggestions();
      }, RETRY_DELAY * (retryCount + 1));
    }
  };

  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setErrorType(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      // Choose endpoint based on whether it's a quick reply or contextual reply
      const endpoint = message.isQuickReply ? '/api/ai/suggest-quick-reply' : '/api/ai/suggest-reply';
      
      console.log('AutoReplyComposer - Fetching suggestions:', {
        endpoint,
        isQuickReply: message.isQuickReply,
        message,
        threadContext: threadContext?.length
      });
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: message,
          thread_context: !message.isQuickReply ? threadContext : undefined,
          tone: selectedTone,
          length: selectedLength
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch suggestions');
      }

      const data = await response.json();
      console.log('AutoReplyComposer - Received suggestions:', data);
      
      if (data.status === 'success' && data.suggestions) {
        setSuggestions(data.suggestions);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      handleError(error);
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
    try {
      onSelectReply(suggestion.text);
      onClose();
      
      toast({
        title: 'Reply selected',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error selecting reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to select reply',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleRetry = () => {
    setRetryCount(0); // Reset retry count for manual retry
    fetchSuggestions();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <Box 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl"
        maxH="90vh"
        display="flex"
        flexDirection="column"
        overflow="hidden" // Prevent outer box from scrolling
      >
        {/* Header - Static */}
        <Box flexShrink={0}>
          <Flex p={4} borderBottom="1px" borderColor="gray.700" justify="space-between" align="center">
            <Text fontSize="lg" fontWeight="semibold" color="white">
              {message.is_improvement ? 'Improve Message' : 'Reply Suggestions'}
            </Text>
            <IconButton
              icon={<CloseIcon />}
              size="sm"
              variant="ghost"
              colorScheme="whiteAlpha"
              onClick={onClose}
            />
          </Flex>
        </Box>

        {/* Original Message - Static */}
        <Box flexShrink={0}>
          <Box p={4} borderBottom="1px" borderColor="gray.700" bg="gray.750">
            <Flex align="center" gap={2} mb={2}>
              <Text fontSize="sm" color="gray.400">
                {message.is_improvement ? 'Original:' : 'Replying to:'}
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
        </Box>

        {/* Options - Static */}
        <Box flexShrink={0}>
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
                  isDisabled={isLoading}
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
                  isDisabled={isLoading}
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
              onClick={fetchSuggestions}
              isLoading={isLoading}
              width="full"
              colorScheme="blue"
              loadingText="Generating..."
              isDisabled={isLoading}
            >
              Generate
            </Button>
          </Box>
        </Box>

        {/* Suggestions - Scrollable */}
        <Box 
          flex="1"
          overflowY="auto"
          minH="200px"
          css={{
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'var(--chakra-colors-gray-800)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--chakra-colors-gray-600)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: 'var(--chakra-colors-gray-500)',
            },
          }}
        >
          <Box p={4} pb={8}> {/* Added bottom padding */}
            {error && (
              <Alert 
                status={
                  errorType === ERROR_TYPES.NETWORK || errorType === ERROR_TYPES.SERVER
                    ? 'warning'
                    : errorType === ERROR_TYPES.TOKEN
                    ? 'error'
                    : 'error'
                }
                mb={4} 
                borderRadius="md"
                variant="left-accent"
              >
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle>
                    {errorType === ERROR_TYPES.NETWORK
                      ? 'Connection Error'
                      : errorType === ERROR_TYPES.TOKEN
                      ? 'Authentication Error'
                      : errorType === ERROR_TYPES.RATE_LIMIT
                      ? 'Rate Limited'
                      : 'Error'}
                  </AlertTitle>
                  <AlertDescription display="block">
                    {error}
                    {retryCount > 0 && retryCount < MAX_RETRIES && (
                      <Text mt={1} fontSize="sm">
                        Retrying... Attempt {retryCount} of {MAX_RETRIES}
                      </Text>
                    )}
                  </AlertDescription>
                </Box>
                {(errorType === ERROR_TYPES.NETWORK || 
                  errorType === ERROR_TYPES.SERVER ||
                  errorType === ERROR_TYPES.API) && (
                  <IconButton
                    icon={<RepeatIcon />}
                    onClick={handleRetry}
                    variant="ghost"
                    colorScheme={errorType === ERROR_TYPES.NETWORK ? 'yellow' : 'red'}
                    size="sm"
                    ml={2}
                    isLoading={isLoading}
                    aria-label="Retry"
                  />
                )}
              </Alert>
            )}

            {isLoading && !error && (
              <Flex direction="column" align="center" justify="center" py={8}>
                <Spinner size="xl" color="blue.400" thickness="4px" speed="0.65s" mb={4} />
                <Text color="gray.400">Generating AI suggestions...</Text>
                {retryCount > 0 && (
                  <Text color="gray.500" fontSize="sm" mt={2}>
                    Retry attempt {retryCount} of {MAX_RETRIES}
                  </Text>
                )}
              </Flex>
            )}

            {suggestions.length > 0 ? (
              <VStack spacing={4} align="stretch">
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
                    bg="gray.750"
                    role="button"
                    aria-label={`Select suggestion ${index + 1}`}
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
              </VStack>
            ) : !isLoading && !error && (
              <Text textAlign="center" color="gray.400" py={8}>
                Click "Generate" to get AI-powered suggestions
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default AutoReplyComposer; 