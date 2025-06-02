import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ChakraProvider, extendTheme, Box } from '@chakra-ui/react';
import { store } from './store';
import Toast from './components/common/Toast';
import PendingInvitations from './components/invitations/PendingInvitations';
import { useSelector } from 'react-redux';
import { selectUser } from './store/slices/authSlice';
import MainRoutes from './routes/MainRoutes';
import LogoutButton from './components/common/LogoutButton';

// Extend Chakra UI theme
const theme = extendTheme({
  styles: {
    global: {
      'html, body': {
        margin: 0,
        padding: 0,
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      },
      '#root': {
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      },
      body: {
        bg: 'gray.900',
        color: 'white',
      },
    },
  },
  colors: {
    brand: {
      50: '#E6F6FF',
      100: '#BAE3FF',
      200: '#7CC4FA',
      300: '#47A3F3',
      400: '#2186EB',
      500: '#0967D2',
      600: '#0552B5',
      700: '#03449E',
      800: '#01337D',
      900: '#002159',
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
  },
});

// Create a wrapper component for authenticated content
const AuthenticatedContent = () => {
  const user = useSelector(selectUser);
  
  return (
    <Box position="relative" h="100vh" w="100vw" overflow="hidden">
      {user && (
        <>
          <Box position="fixed" top={4} right={4} zIndex={1000}>
            <PendingInvitations />
          </Box>
          <LogoutButton />
        </>
      )}
      <Box h="100%" w="100%" overflow="hidden">
        <MainRoutes />
        <Toast />
      </Box>
    </Box>
  );
};

const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <Provider store={store}>
        <Router>
          <AuthenticatedContent />
        </Router>
      </Provider>
    </ChakraProvider>
  );
};

export default App;
