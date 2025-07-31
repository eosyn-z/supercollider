import React, { useState } from 'react';
import ApiKeyModal from './ApiKeyModal';

const mockApiList = [
  {
    name: "OpenAI GPT-4",
    category: "AI/ML",
    description: "Advanced language model for text generation and conversation",
    signup_url: "https://platform.openai.com/signup",
    requires_key: true,
    free_tier: false,
    task_tags: ["text:generation", "text:completion", "text:chat"],
    rate_limit: "Varies by plan",
    notes: "State-of-the-art language model"
  },
  {
    name: "NASA APOD",
    service: "NASA",
    category: "Data",
    description: "Astronomy Picture of the Day from NASA",
    requires_key: false,
    free_tier: true,
    key: "DEMO_KEY",
    task_tags: ["data:space", "data:astronomy", "image:space"],
    rate_limit: "30/hour per IP",
    notes: "Free access to space imagery and data"
  },
  {
    name: "Weather API",
    service: "OpenWeatherMap",
    category: "Weather",
    description: "Current weather data and forecasts",
    signup_url: "https://openweathermap.org/api",
    requires_key: true,
    free_tier: true,
    task_tags: ["data:weather", "data:forecast"],
    rate_limit: "60 calls/minute",
    notes: "Free tier available with 1000 calls/day"
  }
];

const ApiKeyModalDemo: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedData, setSavedData] = useState<{api: any, key: string} | null>(null);

  const handleSave = (data: {api: any, key: string}) => {
    setSavedData(data);
    console.log('API Key Modal saved:', data);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>API Key Modal Demo</h1>
      
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          padding: '12px 24px',
          backgroundColor: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
          marginBottom: '20px'
        }}
      >
        Open API Key Modal
      </button>

      {savedData && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          marginTop: '20px'
        }}>
          <h3>Saved API Configuration:</h3>
          <p><strong>Service:</strong> {savedData.api.name || savedData.api.service}</p>
          <p><strong>Key:</strong> {savedData.key || 'No key required'}</p>
          <p><strong>Description:</strong> {savedData.api.description}</p>
          <p><strong>Free Tier:</strong> {savedData.api.free_tier ? 'Yes' : 'No'}</p>
          <p><strong>Requires Key:</strong> {savedData.api.requires_key ? 'Yes' : 'No'}</p>
        </div>
      )}

      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        apiList={mockApiList}
      />
    </div>
  );
};

export default ApiKeyModalDemo;