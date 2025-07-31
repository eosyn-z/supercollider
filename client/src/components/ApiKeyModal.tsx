import React, { useState, useMemo } from 'react';

interface ApiEntry {
  name?: string;
  service?: string;
  category?: string;
  description?: string;
  signup_url?: string;
  requires_key: boolean;
  free_tier: boolean;
  key?: string;
  can_generate_text?: boolean;
  can_generate_image?: boolean;
  can_read_image?: boolean;
  can_generate_audio?: boolean;
  can_generate_video?: boolean;
  filetypes_supported?: string[];
  task_tags?: string[];
  rate_limit?: string;
  notes?: string;
}

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { api: ApiEntry; key: string }) => void;
  apiList: ApiEntry[];
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  apiList
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFreeTier, setFilterFreeTier] = useState(false);
  const [filterRequiresKey, setFilterRequiresKey] = useState(false);
  const [selectedApi, setSelectedApi] = useState<ApiEntry | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const filteredApis = useMemo(() => {
    return apiList.filter(api => {
      const searchMatch = !searchTerm || 
        (api.name || api.service || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (api.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (api.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (api.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (api.task_tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const freeTierMatch = !filterFreeTier || api.free_tier;
      const requiresKeyMatch = !filterRequiresKey || api.requires_key;
      
      return searchMatch && freeTierMatch && requiresKeyMatch;
    });
  }, [apiList, searchTerm, filterFreeTier, filterRequiresKey]);

  const handleSave = () => {
    if (!selectedApi) {
      setError('Please select an API');
      return;
    }
    
    if (selectedApi.requires_key && !apiKey.trim()) {
      setError('API key is required for this service');
      return;
    }
    
    setError('');
    onSave({ api: selectedApi, key: apiKey.trim() });
    handleClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    setFilterFreeTier(false);
    setFilterRequiresKey(false);
    setSelectedApi(null);
    setApiKey('');
    setError('');
    onClose();
  };

  const handleApiSelect = (api: ApiEntry) => {
    setSelectedApi(api);
    setApiKey(api.key || '');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Select API Service</h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search APIs by name, category, description, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              marginBottom: '12px'
            }}
          />
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterFreeTier}
                onChange={(e) => setFilterFreeTier(e.target.checked)}
              />
              Free tier only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterRequiresKey}
                onChange={(e) => setFilterRequiresKey(e.target.checked)}
              />
              Requires API key
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
          <div style={{ 
            flex: 1, 
            borderRight: '1px solid #eee', 
            paddingRight: '20px',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>
              APIs ({filteredApis.length})
            </h3>
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {filteredApis.map((api, index) => (
                <div
                  key={index}
                  onClick={() => handleApiSelect(api)}
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedApi === api ? '#e3f2fd' : 'white',
                    borderColor: selectedApi === api ? '#2196f3' : '#ddd'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {api.name || api.service}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    {api.description || api.notes}
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {api.free_tier && (
                      <span style={{ 
                        backgroundColor: '#4caf50', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '3px' 
                      }}>
                        Free
                      </span>
                    )}
                    {api.requires_key && (
                      <span style={{ 
                        backgroundColor: '#ff9800', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '3px' 
                      }}>
                        Key Required
                      </span>
                    )}
                    {api.task_tags && api.task_tags.slice(0, 2).map(tag => (
                      <span key={tag} style={{ 
                        backgroundColor: '#e0e0e0', 
                        color: '#333', 
                        padding: '2px 6px', 
                        borderRadius: '3px' 
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, paddingLeft: '20px' }}>
            {selectedApi ? (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                  {selectedApi.name || selectedApi.service}
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                    <strong>Description:</strong> {selectedApi.description || selectedApi.notes || 'No description available'}
                  </p>
                  
                  {selectedApi.rate_limit && (
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      <strong>Rate Limit:</strong> {selectedApi.rate_limit}
                    </p>
                  )}
                  
                  {selectedApi.task_tags && selectedApi.task_tags.length > 0 && (
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      <strong>Capabilities:</strong> {selectedApi.task_tags.join(', ')}
                    </p>
                  )}
                  
                  {selectedApi.filetypes_supported && selectedApi.filetypes_supported.length > 0 && (
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      <strong>Supported formats:</strong> {selectedApi.filetypes_supported.join(', ')}
                    </p>
                  )}
                  
                  {selectedApi.signup_url && (
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                      <a 
                        href={selectedApi.signup_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#2196f3', textDecoration: 'underline' }}
                      >
                        Sign up for API access
                      </a>
                    </p>
                  )}
                </div>

                {selectedApi.requires_key && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      API Key:
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                )}

                {error && (
                  <div style={{ 
                    color: '#f44336', 
                    backgroundColor: '#ffebee', 
                    padding: '12px', 
                    borderRadius: '4px', 
                    marginBottom: '16px',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '12px 24px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: '#2196f3',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#666', paddingTop: '60px' }}>
                <p>Select an API from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;