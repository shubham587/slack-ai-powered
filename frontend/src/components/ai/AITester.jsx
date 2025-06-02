import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { generateResponse, fetchUsageStats } from '../../store/slices/aiSlice';
import AIStatusIndicator from './AIStatusIndicator';
import ModelPreference from './ModelPreference';

const AITester = () => {
  const dispatch = useDispatch();
  const [prompt, setPrompt] = useState('');
  const { 
    lastResponse, 
    isGenerating, 
    error,
    preferredModel 
  } = useSelector((state) => state.ai);

  // Fetch usage stats periodically
  useEffect(() => {
    dispatch(fetchUsageStats());
    const interval = setInterval(() => {
      dispatch(fetchUsageStats());
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    await dispatch(generateResponse({
      prompt,
      modelVersion: preferredModel,
      temperature: 0.7
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6">AI Integration Tester</h2>
          
          {/* Model Preference */}
          <div className="mb-8">
            <ModelPreference />
          </div>
          
          {/* Test Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Test Prompt (using {preferredModel === '3.5' ? 'GPT-3.5' : 'GPT-4'})
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your test prompt here..."
              />
            </div>
            
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                isGenerating || !prompt.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isGenerating ? 'Generating...' : 'Test Generate'}
            </button>
          </form>
          
          {/* Response Display */}
          {lastResponse && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Response:</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                <pre className="whitespace-pre-wrap text-sm">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {error && !isGenerating && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {/* Status Indicator */}
      <AIStatusIndicator />
    </div>
  );
};

export default AITester; 