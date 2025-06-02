import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../store/slices/authSlice';
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

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...registerData } = formData;
      await dispatch(register(registerData)).unwrap();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to register');
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
                Create your account
              </Heading>
              <Text color="gray.400" fontSize="sm" textAlign="center">
                Join Slack AI-Powered to start collaborating
              </Text>
            </VStack>
          </VStack>

          {/* Error Alert */}
          {error && (
            <Alert status="error" bg="red.900" color="white" borderRadius="md">
              <AlertIcon color="red.200" />
              {error}
            </Alert>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel color="gray.300">Username</FormLabel>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  bg="gray.700"
                  border="1px"
                  borderColor="gray.600"
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                  color="white"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="gray.300">Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  bg="gray.700"
                  border="1px"
                  borderColor="gray.600"
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                  color="white"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="gray.300">Password</FormLabel>
                <Input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  bg="gray.700"
                  border="1px"
                  borderColor="gray.600"
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                  color="white"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="gray.300">Confirm Password</FormLabel>
                <Input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  bg="gray.700"
                  border="1px"
                  borderColor="gray.600"
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: 'blue.500', boxShadow: 'none' }}
                  color="white"
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                size="lg"
                width="full"
                mt={6}
                isLoading={isLoading}
                loadingText="Creating Account..."
              >
                Create Account
              </Button>
            </VStack>
          </form>

          {/* Login Link */}
          <Text color="gray.400" fontSize="sm" textAlign="center">
            Already have an account?{' '}
            <Link to="/login">
              <Text as="span" color="blue.400" _hover={{ color: 'blue.300' }}>
                Sign in here
              </Text>
            </Link>
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default Register; 