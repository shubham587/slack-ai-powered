import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  VStack,
  Text,
  Icon,
  Button,
  useDisclosure,
  Divider,
  List,
  ListItem,
  Badge,
  Flex,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { AddIcon, LockIcon, ChatIcon, SettingsIcon } from '@chakra-ui/icons';
import {
  fetchChannels,
  selectPublicChannels,
  selectPrivateChannels,
  selectDirectMessageChannels,
  setActiveChannel,
} from '../../store/slices/channelsSlice';
import CreateChannelModal from './CreateChannelModal';
import { useNavigate } from 'react-router-dom';

const ChannelList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const publicChannels = useSelector(selectPublicChannels);
  const privateChannels = useSelector(selectPrivateChannels);
  const directMessages = useSelector(selectDirectMessageChannels);
  
  useEffect(() => {
    dispatch(fetchChannels());
  }, [dispatch]);
  
  const handleChannelClick = (channel) => {
    dispatch(setActiveChannel(channel));
    navigate(`/chat/${channel.id}`);
  };
  
  const renderChannelItem = (channel) => (
    <ListItem
      key={channel.id}
      onClick={() => handleChannelClick(channel)}
      cursor="pointer"
      p={2}
      borderRadius="md"
      _hover={{ bg: 'gray.700' }}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      <Flex align="center">
        <Icon
          as={channel.is_private ? LockIcon : ChatIcon}
          mr={2}
          color="gray.400"
        />
        <Text>{channel.name}</Text>
      </Flex>
      {channel.is_private && (
        <Tooltip label="Channel Settings">
          <IconButton
            icon={<SettingsIcon />}
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Handle channel settings
            }}
          />
        </Tooltip>
      )}
    </ListItem>
  );
  
  return (
    <Box w="100%" h="100%" bg="gray.800" color="white" p={4}>
      <VStack spacing={6} align="stretch">
        {/* Public Channels */}
        <Box>
          <Flex justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight="bold" color="gray.400">
              Channels
            </Text>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<AddIcon />}
              onClick={onOpen}
            >
              Add
            </Button>
          </Flex>
          <List spacing={1}>
            {publicChannels.map(renderChannelItem)}
          </List>
        </Box>
        
        {/* Private Channels */}
        {privateChannels.length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="bold" color="gray.400" mb={2}>
              Private Channels
            </Text>
            <List spacing={1}>
              {privateChannels.map(renderChannelItem)}
            </List>
          </Box>
        )}
        
        <Divider borderColor="gray.600" />
        
        {/* Direct Messages */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" color="gray.400" mb={2}>
            Direct Messages
          </Text>
          <List spacing={1}>
            {directMessages.map((channel) => (
              <ListItem
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                cursor="pointer"
                p={2}
                borderRadius="md"
                _hover={{ bg: 'gray.700' }}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Flex align="center">
                  <Text>
                    {channel.members
                      .filter((m) => m.id !== user?.id)
                      .map((m) => m.username)
                      .join(', ')}
                  </Text>
                </Flex>
                {channel.unread_count > 0 && (
                  <Badge colorScheme="red" borderRadius="full">
                    {channel.unread_count}
                  </Badge>
                )}
              </ListItem>
            ))}
          </List>
        </Box>
      </VStack>
      
      <CreateChannelModal isOpen={isOpen} onClose={onClose} />
    </Box>
  );
};

export default ChannelList; 