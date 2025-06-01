import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ChakraProvider, extendTheme, Box } from '@chakra-ui/react';
import { store } from './store';
import AppRoutes from './routes';
import Toast from './components/common/Toast';
import PendingInvitations from './components/invitations/PendingInvitations';
import { useSelector } from 'react-redux';
import { selectUser } from './store/slices/authSlice';

// Extend Chakra UI theme
const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
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
    <Box position="relative">
      {user && (
        <Box position="fixed" top={4} right={4} zIndex={1000}>
          <PendingInvitations />
        </Box>
      )}
      <div className="min-h-screen bg-primary-background">
        <AppRoutes />
        <Toast />
      </div>
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
