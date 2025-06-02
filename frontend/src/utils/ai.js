import axios from 'axios';

const API_BASE_URL = '/api/ai';

// Cache for storing AI responses
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries
 */
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
};

/**
 * Generate a cache key from request parameters
 */
const generateCacheKey = (prompt, modelVersion, temperature, maxTokens, systemPrompt) => {
  return JSON.stringify({ prompt, modelVersion, temperature, maxTokens, systemPrompt });
};

/**
 * Generate AI response with caching
 */
export const generateAIResponse = async ({
  prompt,
  modelVersion = '3.5',
  temperature = 0.7,
  maxTokens = null,
  systemPrompt = null,
  skipCache = false
}) => {
  // Generate cache key
  const cacheKey = generateCacheKey(prompt, modelVersion, temperature, maxTokens, systemPrompt);
  
  // Check cache if not skipping
  if (!skipCache) {
    clearExpiredCache();
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }
  }
  
  try {
    const response = await axios.post(`${API_BASE_URL}/generate`, {
      prompt,
      model_version: modelVersion,
      temperature,
      max_tokens: maxTokens,
      system_prompt: systemPrompt
    });
    
    // Cache the response
    if (!skipCache) {
      responseCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw error;
  }
};

/**
 * Get AI usage statistics
 */
export const getAIUsageStats = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/usage`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Check AI service health
 */
export const checkAIHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
}; 