import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  VStack,
  Box,
  Text,
  Input,
  Textarea,
  useToast,
  Spinner,
  Flex,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { EditIcon, DownloadIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';

const NotesModal = ({
  isOpen,
  onClose,
  channelId,
  threadId = null,
  channelName,
  threadTitle = null,
}) => {
  const [notes, setNotes] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(null);
  const toast = useToast();
  const currentUser = useSelector(selectUser);

  // Debug logs for props
  useEffect(() => {
    if (isOpen) {
      console.log('NotesModal opened with props:', {
        channelId,
        threadId,
        channelName,
        threadTitle
      });
    }
  }, [isOpen]);

  // First, try to get the channel ID for the thread if we don't have it
  const getThreadChannelId = async (threadId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/messages/${threadId}/replies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch thread details');
      }

      const replies = await response.json();
      if (replies && replies.length > 0) {
        // The replies will have the channel_id
        return replies[0].channel_id;
      }

      // If no replies, try to get the parent message from the thread ID itself
      // The thread ID is the parent message ID
      const parentResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/messages/${threadId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });

      if (!parentResponse.ok) {
        throw new Error('Failed to fetch parent message');
      }

      const parentMessage = await parentResponse.json();
      return parentMessage.channel_id;
    } catch (error) {
      console.error('Error fetching thread channel ID:', error);
      return null;
    }
  };

  const generateNotes = async () => {
    console.log('Generating notes...');
    try {
      let finalChannelId = channelId;

      // If we have a threadId but no channelId, try to get it from the thread
      if (threadId && !channelId) {
        console.log('Fetching channel ID for thread:', threadId);
        finalChannelId = await getThreadChannelId(threadId);
        
        if (!finalChannelId) {
          throw new Error('Could not determine channel ID for the thread');
        }
      }

      if (!finalChannelId) {
        throw new Error('Channel ID is required to generate notes');
      }

      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const queryParams = new URLSearchParams({
        channel_id: finalChannelId,
        ...(threadId ? { thread_id: threadId } : {})
      });
      
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/ai/generate-notes?${queryParams}`;
      
      console.log('Making API call to:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.detail || errorData.message || `Failed to generate notes: ${response.status}`);
      }

      const data = await response.json();
      console.log('Notes generation response:', data);
      
      if (data.status === 'error' || data.error) {
        throw new Error(data.error || data.message || 'Failed to generate notes');
      }

      const notesData = data.data || data;
      
      // Transform the response if needed
      const formattedNotes = {
        id: notesData.id,
        title: notesData.title || `Notes for ${threadId ? 'Thread' : 'Channel'}: ${threadTitle || channelName}`,
        sections: notesData.sections || [],
        created_at: notesData.created_at,
        updated_at: notesData.updated_at,
        version: notesData.version,
        is_draft: notesData.is_draft
      };
      
      setNotes(formattedNotes);
      setEditedNotes(formattedNotes);
      
      toast({
        title: 'Success',
        description: 'Notes generated successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error generating notes:', error);
      toast({
        title: 'Error generating notes',
        description: error.message || 'Failed to generate notes',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Call generateNotes when modal opens
  useEffect(() => {
    if (isOpen && (channelId || threadId)) {
      console.log('Modal opened, calling generateNotes');
      generateNotes();
    }
  }, [isOpen, channelId, threadId]);

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notes/${notes.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedNotes),
          credentials: 'include'
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.message || 'Failed to save notes');
      }

      const data = await response.json();
      
      if (data.status === 'error' || data.error) {
        throw new Error(data.error || data.message || 'Failed to save notes');
      }
      
      const notesData = data.data || data;
      setNotes(notesData);
      setEditedNotes(notesData);
      setIsEditing(false);
      
      toast({
        title: 'Success',
        description: 'Notes saved successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save notes',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleExport = () => {
    try {
      // Create markdown content
      let markdown = `# ${notes.title}\n\n`;
      markdown += `Generated from ${threadId ? 'thread' : 'channel'}: ${channelName}\n`;
      if (threadTitle) {
        markdown += `Thread: ${threadTitle}\n`;
      }
      markdown += `Generated by: ${currentUser.username}\n`;
      markdown += `Date: ${new Date().toLocaleString()}\n\n`;

      notes.sections.forEach(section => {
        markdown += `## ${section.title}\n\n`;
        section.content.forEach(item => {
          markdown += `* ${item}\n`;
        });
        markdown += '\n';
      });

      // Create and download file
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${notes.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Notes exported successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to export notes',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>
          <Flex justify="space-between" align="center">
            <Text>Meeting Notes</Text>
            <Flex gap={2}>
              {notes && !isEditing && (
                <>
                  <Tooltip label="Edit Notes">
                    <IconButton
                      icon={<EditIcon />}
                      onClick={() => setIsEditing(true)}
                      size="sm"
                      colorScheme="blue"
                    />
                  </Tooltip>
                  <Tooltip label="Export as Markdown">
                    <IconButton
                      icon={<DownloadIcon />}
                      onClick={handleExport}
                      size="sm"
                      colorScheme="green"
                    />
                  </Tooltip>
                </>
              )}
              {isEditing && (
                <>
                  <Tooltip label="Save Changes">
                    <IconButton
                      icon={<CheckIcon />}
                      onClick={handleSave}
                      size="sm"
                      colorScheme="green"
                    />
                  </Tooltip>
                  <Tooltip label="Cancel Editing">
                    <IconButton
                      icon={<CloseIcon />}
                      onClick={() => {
                        setIsEditing(false);
                        setEditedNotes(notes);
                      }}
                      size="sm"
                      colorScheme="red"
                    />
                  </Tooltip>
                </>
              )}
            </Flex>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          {isLoading ? (
            <Flex justify="center" align="center" minH="300px">
              <Spinner size="xl" color="blue.500" />
            </Flex>
          ) : notes ? (
            <VStack spacing={6} align="stretch">
              {isEditing ? (
                // Edit Mode
                <>
                  <Input
                    value={editedNotes.title}
                    onChange={(e) => setEditedNotes({
                      ...editedNotes,
                      title: e.target.value
                    })}
                    fontWeight="bold"
                    size="lg"
                    bg="gray.700"
                  />
                  {editedNotes.sections.map((section, sectionIndex) => (
                    <Box key={sectionIndex}>
                      <Input
                        value={section.title}
                        onChange={(e) => {
                          const newSections = [...editedNotes.sections];
                          newSections[sectionIndex].title = e.target.value;
                          setEditedNotes({
                            ...editedNotes,
                            sections: newSections
                          });
                        }}
                        fontWeight="semibold"
                        mb={2}
                        bg="gray.700"
                      />
                      <VStack spacing={2} align="stretch">
                        {section.content.map((item, itemIndex) => (
                          <Textarea
                            key={itemIndex}
                            value={item}
                            onChange={(e) => {
                              const newSections = [...editedNotes.sections];
                              newSections[sectionIndex].content[itemIndex] = e.target.value;
                              setEditedNotes({
                                ...editedNotes,
                                sections: newSections
                              });
                            }}
                            size="sm"
                            bg="gray.700"
                          />
                        ))}
                      </VStack>
                    </Box>
                  ))}
                </>
              ) : (
                // View Mode
                <>
                  <Text fontSize="2xl" fontWeight="bold">
                    {notes.title}
                  </Text>
                  {notes.sections.map((section, index) => (
                    <Box key={index}>
                      <Text fontSize="xl" fontWeight="semibold" mb={2}>
                        {section.title}
                      </Text>
                      <VStack spacing={2} align="stretch" pl={4}>
                        {section.content.map((item, itemIndex) => (
                          <Text key={itemIndex}>• {item}</Text>
                        ))}
                      </VStack>
                    </Box>
                  ))}
                </>
              )}
            </VStack>
          ) : (
            <Text color="gray.400" textAlign="center">
              No notes generated yet
            </Text>
          )}
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Close
          </Button>
          {notes && !isLoading && (
            <Button
              colorScheme="green"
              onClick={generateNotes}
              leftIcon={<Spinner size="sm" />}
            >
              Regenerate
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default NotesModal; 