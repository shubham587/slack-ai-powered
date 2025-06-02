import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../store/slices/authSlice';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  Heading,
  Alert,
  AlertIcon,
  Container,
  useColorModeValue,
} from '@chakra-ui/react';
import Logo from '../components/common/Logo';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await dispatch(login(formData)).unwrap();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      bg="gray.900"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={12}
      px={4}
    >
      <Container maxW="md" p={8} bg="gray.800" borderRadius="xl" boxShadow="2xl">
        <VStack spacing={8} align="stretch">
          {/* Logo and Title */}
          <VStack spacing={6}>
            <Logo size="lg" />
            <VStack spacing={2}>
              <Heading
                as="h1"
                fontSize="2xl"
                fontWeight="bold"
                textAlign="center"
                color="white"
              >
                Welcome back
              </Heading>
              <Text color="gray.400" fontSize="sm" textAlign="center">
                Sign in to continue to Slack AI-Powered
              </Text>
            </VStack>
          </VStack>

          {/* Error Alert */}
          {error && (
            <Alert status="error" borderRadius="md" bg="red.900" color="white">
              <AlertIcon />
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel color="gray.400">Username or Email</FormLabel>
                <Input
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  bg="gray.700"
                  border="none"
                  color="white"
                  _placeholder={{ color: 'gray.400' }}
                  _hover={{ bg: 'gray.600' }}
                  _focus={{ bg: 'gray.600', boxShadow: 'none' }}
                  size="lg"
                />
              </FormControl>

              <FormControl>
                <FormLabel color="gray.400">Password</FormLabel>
                <Input
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  bg="gray.700"
                  border="none"
                  color="white"
                  _placeholder={{ color: 'gray.400' }}
                  _hover={{ bg: 'gray.600' }}
                  _focus={{ bg: 'gray.600', boxShadow: 'none' }}
                  size="lg"
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                width="full"
                isLoading={isLoading}
                loadingText="Signing in..."
                _hover={{ bg: 'blue.600' }}
                mt={2}
              >
                Sign in
              </Button>
            </VStack>
          </form>

          {/* Register Link */}
          <Text color="gray.400" fontSize="sm" textAlign="center">
            Don't have an account?{' '}
            <Link to="/register">
              <Text as="span" color="blue.400" _hover={{ color: 'blue.300' }}>
                Create one now
              </Text>
            </Link>
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default Login; 