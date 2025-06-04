import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Switch,
  Select,
  useToast,
  Divider,
  Text,
  Box,
  useColorMode
} from '@chakra-ui/react';
import { selectUser } from '../../store/slices/authSlice';

const UserSettings = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const toast = useToast();
  const { colorMode, setColorMode } = useColorMode();

  const [settings, setSettings] = useState({
    theme: colorMode,
    notifications: true,
    soundEnabled: true,
    desktopNotifications: true,
    messagePreview: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      theme: colorMode
    }));
  }, [colorMode]);

  const handleThemeChange = (event) => {
    const newTheme = event.target.value;
    setSettings(prev => ({ ...prev, theme: newTheme }));
    setColorMode(newTheme);
  };

  const handleToggle = (field) => {
    setSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/users/settings`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      toast({
        title: 'Settings updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>User Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Theme</FormLabel>
              <Select value={settings.theme} onChange={handleThemeChange}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </FormControl>
            <Divider />
            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">
                Enable Notifications
              </FormLabel>
              <Switch
                isChecked={settings.notifications}
                onChange={() => handleToggle('notifications')}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">
                Sound
              </FormLabel>
              <Switch
                isChecked={settings.soundEnabled}
                onChange={() => handleToggle('soundEnabled')}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">
                Desktop Notifications
              </FormLabel>
              <Switch
                isChecked={settings.desktopNotifications}
                onChange={() => handleToggle('desktopNotifications')}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">
                Message Preview
              </FormLabel>
              <Switch
                isChecked={settings.messagePreview}
                onChange={() => handleToggle('messagePreview')}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={handleSave}>
            Save Changes
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UserSettings; 