import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ChakraProvider, extendTheme, Box, ColorModeScript } from '@chakra-ui/react';
import { store } from './store';
import Toast from './components/common/Toast';
import PendingInvitations from './components/invitations/PendingInvitations';
import { useSelector } from 'react-redux';
import { selectUser } from './store/slices/authSlice';
import MainRoutes from './routes/MainRoutes';
import { initializeSocket, disconnectSocket } from './socket';

// Extend Chakra UI theme
const config = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  styles: {
    global: (props) => ({
      'html, body': {
        margin: 0,
        padding: 0,
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        bg: props.colorMode === 'dark' ? 'gray.900' : 'white',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      },
      '#root': {
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      },
    }),
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
  const [socketInitialized, setSocketInitialized] = React.useState(false);
  
  React.useEffect(() => {
    if (user && !socketInitialized) {
      const token = localStorage.getItem('token');
      if (token) {
        initializeSocket(token);
        setSocketInitialized(true);
      }
    }
    
    return () => {
      if (!user) {
        disconnectSocket();
        setSocketInitialized(false);
      }
    };
  }, [user, socketInitialized]);
  
  return (
    <Box position="relative" h="100vh" w="100vw" overflow="hidden">
      {user && (
        <Box position="fixed" top={4} right={4} zIndex={1000}>
          <PendingInvitations />
        </Box>
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
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <Provider store={store}>
          <Router>
            <AuthenticatedContent />
          </Router>
        </Provider>
      </ChakraProvider>
    </>
  );
};

export default App;
