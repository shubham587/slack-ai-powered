import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Input,
  Text,
  Icon,
  Progress,
  VStack,
  HStack,
  Image,
  Button,
  useToast,
} from '@chakra-ui/react';
import { AttachmentIcon, CloseIcon } from '@chakra-ui/icons';
import { useDropzone } from 'react-dropzone';

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB
const ALLOWED_TYPES = {
  'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
  'application/pdf': ['.pdf'],
  'text/*': ['.txt', '.md'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
  'application/x-tar': ['.tar'],
  'application/gzip': ['.gz'],
  'text/javascript': ['.js', '.jsx'],
  'text/typescript': ['.ts', '.tsx'],
  'application/json': ['.json'],
  'text/html': ['.html'],
  'text/css': ['.css'],
  'text/plain': ['.txt', '.md', '.py']
};

const FileUpload = ({ onFileSelect, onRemove }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const toast = useToast();
  const progressIntervalRef = useRef(null);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Clear any ongoing progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      // Clear preview and progress
      setPreview(null);
      setUploadProgress(0);
    };
  }, []);

  const onDrop = (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(file => {
        toast({
          title: 'File upload error',
          description: `${file.file.name} was rejected: ${file.errors[0].message}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      return;
    }

    const file = acceptedFiles[0];
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // Log file details
    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    onFileSelect(file);
    simulateProgress();
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    // Store interval reference
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressIntervalRef.current);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: ALLOWED_TYPES,
    multiple: false,
  });

  const handleRemove = () => {
    setPreview(null);
    setUploadProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    onRemove();
  };

  const getFileTypeDisplay = () => {
    const types = Object.values(ALLOWED_TYPES).flat();
    return types.map(type => type.replace('.', '')).join(', ');
  };

  return (
    <VStack spacing={4} width="100%">
      <Box
        {...getRootProps()}
        width="100%"
        p={4}
        border="2px dashed"
        borderColor={isDragActive ? "blue.500" : "gray.300"}
        borderRadius="md"
        bg={isDragActive ? "blue.50" : "transparent"}
        cursor="pointer"
        transition="all 0.2s"
        _hover={{ borderColor: "blue.500" }}
      >
        <input {...getInputProps()} />
        <VStack spacing={2}>
          <Icon as={AttachmentIcon} w={6} h={6} />
          <Text textAlign="center">
            {isDragActive
              ? "Drop the file here"
              : "Drag and drop a file here, or click to select"}
          </Text>
          <Text fontSize="sm" color="gray.500">
            Max file size: 16MB
          </Text>
          <Text fontSize="xs" color="gray.400">
            Supported formats: {getFileTypeDisplay()}
          </Text>
        </VStack>
      </Box>

      {uploadProgress > 0 && (
        <Box width="100%">
          <Progress value={uploadProgress} size="sm" colorScheme="blue" />
        </Box>
      )}

      {preview && (
        <Box position="relative" width="100%">
          <Image src={preview} alt="Preview" maxH="200px" objectFit="contain" />
          <Button
            position="absolute"
            top={2}
            right={2}
            size="sm"
            colorScheme="red"
            onClick={handleRemove}
          >
            <Icon as={CloseIcon} />
          </Button>
        </Box>
      )}
    </VStack>
  );
};

export default FileUpload; 