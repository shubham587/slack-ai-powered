import { useState } from 'react';
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
  Box
} from '@chakra-ui/react';
import { selectUser } from '../../store/slices/authSlice';

const UserSettings = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const toast = useToast();
  const [settings, setSettings] = useState({
    theme: 'dark',
    notifications: true,
    soundEnabled: true,
    desktopNotifications: true,
    messagePreview: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = (field) => {
    setSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const updatedSettings = await response.json();
      dispatch({ type: 'auth/updateSettings', payload: updatedSettings });

      toast({
        title: 'Settings updated',
        status: 'success',
        duration: 3000,
        isClosable: true
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontWeight="bold" mb={4}>Appearance</Text>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">Theme</FormLabel>
                <Select
                  value={settings.theme}
                  onChange={(e) => handleChange('theme', e.target.value)}
                  bg="gray.700"
                  ml={2}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </Select>
              </FormControl>
            </Box>

            <Divider />

            <Box>
              <Text fontWeight="bold" mb={4}>Notifications</Text>
              <VStack spacing={3} align="stretch">
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0">Enable Notifications</FormLabel>
                  <Switch
                    isChecked={settings.notifications}
                    onChange={() => handleToggle('notifications')}
                    ml={2}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0">Sound Effects</FormLabel>
                  <Switch
                    isChecked={settings.soundEnabled}
                    onChange={() => handleToggle('soundEnabled')}
                    ml={2}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0">Desktop Notifications</FormLabel>
                  <Switch
                    isChecked={settings.desktopNotifications}
                    onChange={() => handleToggle('desktopNotifications')}
                    ml={2}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0">Message Preview</FormLabel>
                  <Switch
                    isChecked={settings.messagePreview}
                    onChange={() => handleToggle('messagePreview')}
                    ml={2}
                  />
                </FormControl>
              </VStack>
            </Box>

            <Divider />

            <Box>
              <Text fontWeight="bold" mb={4}>Regional</Text>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">Timezone</FormLabel>
                <Select
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  bg="gray.700"
                  ml={2}
                >
                  {Intl.supportedValuesOf('timeZone').map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UserSettings; 