import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setPreferredModel } from '../../store/slices/aiSlice';

const ModelPreference = () => {
  const dispatch = useDispatch();
  const { preferredModel, usageStats } = useSelector((state) => state.ai);

  const handleModelChange = (model) => {
    dispatch(setPreferredModel(model));
  };

  // Format cost to 4 decimal places
  const formatCost = (cost) => cost?.toFixed(4) || '0.0000';

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">AI Model Preference</h3>
      
      {/* Model Selection */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => handleModelChange('3.5')}
          className={`px-4 py-2 rounded-lg flex-1 ${
            preferredModel === '3.5'
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-gray-100 text-gray-800 border-2 border-transparent'
          }`}
        >
          GPT-3.5
        </button>
        <button
          onClick={() => handleModelChange('4')}
          className={`px-4 py-2 rounded-lg flex-1 ${
            preferredModel === '4'
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-gray-100 text-gray-800 border-2 border-transparent'
          }`}
        >
          GPT-4
        </button>
      </div>

      {/* Usage Statistics */}
      {usageStats && (
        <div className="space-y-2 text-sm">
          <h4 className="font-medium text-gray-700">Usage Statistics</h4>
          
          {/* GPT-3.5 Stats */}
          <div className="bg-gray-50 p-2 rounded">
            <div className="flex justify-between">
              <span>GPT-3.5:</span>
              <span>${formatCost(usageStats['gpt-3.5-turbo']?.total_cost)}</span>
            </div>
            <div className="text-xs text-gray-500">
              {usageStats['gpt-3.5-turbo']?.total_tokens.toLocaleString()} tokens
            </div>
          </div>

          {/* GPT-4 Stats */}
          <div className="bg-gray-50 p-2 rounded">
            <div className="flex justify-between">
              <span>GPT-4:</span>
              <span>${formatCost(usageStats['gpt-4-turbo-preview']?.total_cost)}</span>
            </div>
            <div className="text-xs text-gray-500">
              {usageStats['gpt-4-turbo-preview']?.total_tokens.toLocaleString()} tokens
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelPreference; 