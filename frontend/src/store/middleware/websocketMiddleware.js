import { io } from 'socket.io-client';
import { addMessage, setTypingUsers } from '../slices/chatSlice';

let socket;

export const websocketMiddleware = (store) => (next) => (action) => {
  if (action.type === 'socket/connect') {
    const token = store.getState().auth.token;
    
    socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:5001', {
      auth: { token },
      transports: ['websocket'],
    });

    // Socket event listeners
    socket.on('connect', () => {
      store.dispatch({ type: 'socket/connected' });
    });

    socket.on('disconnect', () => {
      store.dispatch({ type: 'socket/disconnected' });
    });

    socket.on('message', (message) => {
      store.dispatch(addMessage({
        channelId: message.channelId,
        message,
      }));
    });

    socket.on('typing', ({ channelId, users }) => {
      store.dispatch(setTypingUsers({ channelId, users }));
    });
  }

  if (action.type === 'socket/disconnect' && socket) {
    socket.disconnect();
    socket = null;
  }

  if (action.type === 'socket/emit' && socket) {
    const { event, data } = action.payload;
    socket.emit(event, data);
  }

  return next(action);
};

// Action creators
export const connectSocket = () => ({ type: 'socket/connect' });
export const disconnectSocket = () => ({ type: 'socket/disconnect' });
export const emitSocketEvent = (event, data) => ({
  type: 'socket/emit',
  payload: { event, data },
}); 