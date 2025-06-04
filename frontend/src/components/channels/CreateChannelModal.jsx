import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  Textarea,
  useToast,
  useColorMode,
} from '@chakra-ui/react';
import { createChannel } from '../../store/slices/channelsSlice';

const CreateChannelModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const toast = useToast();
  const { colorMode } = useColorMode();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_private: false,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'is_private' ? checked : value,
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Validate channel name
      if (!formData.name.trim()) {
        throw new Error('Channel name is required');
      }
      
      // Create channel
      const result = await dispatch(createChannel(formData)).unwrap();
      
      toast({
        title: 'Channel created',
        description: `#${result.name} has been created successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onClose();
      setFormData({
        name: '',
        description: '',
        is_private: false,
      });
    } catch (error) {
      toast({
        title: 'Error creating channel',
        description: error.message || 'Something went wrong',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        color={colorMode === 'dark' ? 'white' : 'black'}
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      >
        <form onSubmit={handleSubmit}>
          <ModalHeader borderBottom="1px" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
            Create a Channel
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody py={4}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Channel Name</FormLabel>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. project-updates"
                  _placeholder={{ color: colorMode === 'dark' ? 'gray.500' : 'gray.400' }}
                  bg={colorMode === 'dark' ? 'gray.700' : 'white'}
                  borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                  _hover={{ borderColor: colorMode === 'dark' ? 'gray.500' : 'gray.400' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="What's this channel about?"
                  _placeholder={{ color: colorMode === 'dark' ? 'gray.500' : 'gray.400' }}
                  bg={colorMode === 'dark' ? 'gray.700' : 'white'}
                  borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                  _hover={{ borderColor: colorMode === 'dark' ? 'gray.500' : 'gray.400' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                />
              </FormControl>
              
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">
                  Make Private
                </FormLabel>
                <Switch
                  name="is_private"
                  isChecked={formData.is_private}
                  onChange={handleChange}
                  colorScheme="blue"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          
          <ModalFooter borderTop="1px" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
            <Button 
              variant="ghost" 
              mr={3} 
              onClick={onClose}
              _hover={{ bg: colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.100' }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              isLoading={isLoading}
            >
              Create Channel
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default CreateChannelModal; 