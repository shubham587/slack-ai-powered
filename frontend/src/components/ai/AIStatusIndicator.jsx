import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { checkHealth } from '../../store/slices/aiSlice';

const AIStatusIndicator = () => {
  const dispatch = useDispatch();
  const {
    isHealthy,
    isGenerating,
    error,
    isRateLimited,
    rateLimitResetTime
  } = useSelector((state) => state.ai);

  useEffect(() => {
    // Check health status periodically
    const checkHealthStatus = () => {
      dispatch(checkHealth());
    };
    
    checkHealthStatus(); // Initial check
    const interval = setInterval(checkHealthStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [dispatch]);

  // Calculate remaining rate limit time
  const getRateLimitRemaining = () => {
    if (!isRateLimited || !rateLimitResetTime) return null;
    const remaining = Math.max(0, Math.ceil((rateLimitResetTime - Date.now()) / 1000));
    return remaining > 0 ? `${remaining}s` : null;
  };

  const rateLimitRemaining = getRateLimitRemaining();

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2">
      {/* Health Status */}
      <div
        className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
          isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span>AI {isHealthy ? 'Online' : 'Offline'}</span>
      </div>

      {/* Loading State */}
      {isGenerating && (
        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Generating...</span>
        </div>
      )}

      {/* Rate Limit Warning */}
      {isRateLimited && rateLimitRemaining && (
        <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Rate Limited ({rateLimitRemaining})</span>
        </div>
      )}

      {/* Error State */}
      {error && !isRateLimited && (
        <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Error: {error}</span>
        </div>
      )}
    </div>
  );
};

export default AIStatusIndicator; 