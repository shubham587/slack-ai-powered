import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Icon,
  Tooltip,
  HStack,
  Spinner,
  useToast,
  Badge,
  VStack,
} from '@chakra-ui/react';
import { WarningIcon, InfoIcon, CheckIcon } from '@chakra-ui/icons';
import { useDebounce } from 'use-debounce';

const TONE_CONFIG = {
  aggressive: { 
    icon: WarningIcon, 
    color: 'red.400',
    label: 'Aggressive Tone',
    description: 'Your message may sound confrontational or demanding'
  },
  weak: { 
    icon: InfoIcon, 
    color: 'yellow.400',
    label: 'Weak Tone',
    description: 'Your message could be more confident'
  },
  neutral: { 
    icon: CheckIcon, 
    color: 'green.400',
    label: 'Balanced Tone',
    description: 'Your message sounds professional and appropriate'
  },
  confusing: { 
    icon: InfoIcon, 
    color: 'orange.400',
    label: 'Unclear Message',
    description: 'Your message might be hard to understand'
  }
};

const IMPACT_CONFIG = {
  high: { 
    color: 'blue.400',
    label: 'High Impact',
    description: 'Will drive immediate action or response'
  },
  medium: { 
    color: 'purple.400',
    label: 'Medium Impact',
    description: 'Will be noticed but may not prompt urgent action'
  },
  low: { 
    color: 'gray.400',
    label: 'Low Impact',
    description: 'May need more clarity or substance to be effective'
  }
};

const MessageToneAnalyzer = ({ 
  message, 
  channelType,
  onAnalysisComplete,
  isTyping 
}) => {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  
  // Use debounced value for message
  const [debouncedMessage] = useDebounce(message, 2000);

  // Effect to analyze message when debounced value changes
  useEffect(() => {
    const analyzeMessage = async () => {
      if (!debouncedMessage?.trim() || 
          debouncedMessage.length < 10 || 
          isTyping ||
          debouncedMessage === analysis?.lastAnalyzedMessage) {
        return;
      }
      
      try {
        setIsAnalyzing(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/ai/analyze-message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              message: debouncedMessage,
              channel_type: channelType
            }),
            credentials: 'include'
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to analyze message' }));
          throw new Error(errorData.message || 'Failed to analyze message');
        }

        const data = await response.json();
        data.analysis.lastAnalyzedMessage = debouncedMessage;
        setAnalysis(data.analysis);
        
        if (onAnalysisComplete) {
          onAnalysisComplete(data.analysis);
        }
      } catch (error) {
        console.error('Error analyzing message:', error);
        setError(error.message || 'Failed to analyze message');
        setAnalysis(null);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeMessage();
  }, [debouncedMessage, isTyping, analysis, channelType, onAnalysisComplete]);

  if (!message || message.length < 5) return null;

  return (
    <Box>
      <VStack spacing={2} align="start">
        {isAnalyzing ? (
          <HStack>
            <Spinner size="sm" color="blue.400" />
            <Text fontSize="sm" color="gray.400">Analyzing your message...</Text>
          </HStack>
        ) : analysis ? (
          <>
            {/* Tone Feedback */}
            <Tooltip
              label={`${TONE_CONFIG[analysis.tone.toLowerCase()].description}\n\nReasoning: ${analysis.reasoning}`}
              placement="top"
              hasArrow
            >
              <Badge
                colorScheme={TONE_CONFIG[analysis.tone.toLowerCase()].color.split('.')[0]}
                display="flex"
                alignItems="center"
                gap={1}
                px={2}
                py={1}
                borderRadius="full"
              >
                <Icon 
                  as={TONE_CONFIG[analysis.tone.toLowerCase()].icon}
                  boxSize={3}
                />
                <Text fontSize="xs">
                  {TONE_CONFIG[analysis.tone.toLowerCase()].label}
                </Text>
              </Badge>
            </Tooltip>

            {/* Impact Level */}
            <Tooltip
              label={`${IMPACT_CONFIG[analysis.impact.toLowerCase()].description}\n\nReasoning: ${analysis.reasoning}`}
              placement="top"
              hasArrow
            >
              <Badge
                colorScheme={IMPACT_CONFIG[analysis.impact.toLowerCase()].color.split('.')[0]}
                variant="subtle"
                px={2}
                py={1}
                borderRadius="full"
              >
                <Text fontSize="xs">
                  {IMPACT_CONFIG[analysis.impact.toLowerCase()].label}
                </Text>
              </Badge>
            </Tooltip>

            {/* Improvements */}
            {analysis.improvements.length > 0 && (
              <Box
                fontSize="xs"
                color="gray.400"
                mt={1}
                maxW="300px"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                <Tooltip
                  label={analysis.improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}
                  placement="top"
                  hasArrow
                >
                  <Text>💡 Click for improvement suggestions</Text>
                </Tooltip>
              </Box>
            )}
          </>
        ) : error ? (
          <Tooltip label={error} placement="top" hasArrow>
            <Icon as={WarningIcon} color="red.400" boxSize={4} />
          </Tooltip>
        ) : null}
      </VStack>
    </Box>
  );
};

export default MessageToneAnalyzer; 