import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

// Configure axios base URL
const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [selectedState, setSelectedState] = useState('');
  const [maxRecords, setMaxRecords] = useState(100);
  const [extractedData, setExtractedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [states, setStates] = useState([]);

  // Load states on component mount
  React.useEffect(() => {
    loadStates();
  }, []);

  const loadStates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/scraper/states`);
      setStates(response.data.states);
    } catch (error) {
      console.error('Failed to load states:', error);
      showMessage('Failed to connect to backend. Make sure server is running.', 'error');
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleExtract = async () => {
    if (!selectedState) {
      showMessage('Please select a state', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/scraper/extract`, {
        state: selectedState,
        maxRecords: parseInt(maxRecords),
        filters: {}
      });

      if (response.data.success) {
        setExtractedData(response.data.data);
        showMessage(`Successfully extracted ${response.data.records} records from ${selectedState}`, 'success');
      } else {
        showMessage('Extraction failed', 'error');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      if (error.code === 'ERR_NETWORK') {
        showMessage('Cannot connect to backend. Please make sure the server is running on port 5000', 'error');
      } else {
        showMessage(error.response?.data?.error || 'Failed to extract data', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!extractedData.length) {
      showMessage('No data to download', 'error');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/scraper/download`, {
        data: extractedData,
        state: selectedState
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rera_${selectedState.replace(/\s/g, '_')}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      showMessage('File downloaded successfully', 'success');
    } catch (error) {
      console.error('Download error:', error);
      showMessage('Failed to download file', 'error');
    }
  };

  const clearData = () => {
    setExtractedData([]);
    showMessage('Data cleared', 'success');
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    showMessage(`${field} copied to clipboard`, 'success');
  };

  return (
    <div className="container">
      {/* Toast Message */}
      {message.text && (
        <div className={`toast toast-${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="header">
        <h1 className="title">🏢 RERA Data Extractor</h1>
        <p className="subtitle">Extract registered projects from various state RERA authorities</p>
      </div>
      
      <div className="card">
        <div className="form-group">
          <label className="label">Select State:</label>
          <select 
            value={selectedState} 
            onChange={(e) => setSelectedState(e.target.value)}
            className="select"
          >
            <option value="">-- Choose a state --</option>
            {states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Max Records:</label>
          <input 
            type="number" 
            value={maxRecords} 
            onChange={(e) => setMaxRecords(e.target.value)}
            className="input"
            min="1"
            max="1000"
          />
          <span className="helper-text">Number of records to extract (max 1000)</span>
        </div>

        <div className="button-group">
          <button 
            onClick={handleExtract} 
            disabled={loading || !selectedState}
            className={loading ? 'button-disabled' : 'button-primary'}
          >
            {loading ? '⏳ Extracting...' : '🚀 Start Extraction'}
          </button>
          
          {extractedData.length > 0 && (
            <>
              <button 
                onClick={handleDownload}
                className="button-secondary"
              >
                📥 Download CSV
              </button>
              <button 
                onClick={clearData}
                className="button-danger"
              >
                🗑️ Clear Data
              </button>
            </>
          )}
        </div>
      </div>

      {extractedData.length > 0 && (
        <div className="results-card">
          <div className="results-header">
            <h2 className="results-title">
              Extracted Data: {extractedData.length} records
            </h2>
            <div className="stats">
              <span className="badge">✓ Extracted successfully</span>
            </div>
          </div>
          
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr className="table-header">
                  <th className="th">#</th>
                  <th className="th">Project Name</th>
                  <th className="th">Promoter Name</th>
                  <th className="th">Registration No.</th>
                  <th className="th">District</th>
                  <th className="th">Status</th>
                  <th className="th">Extracted At</th>
                 </tr>
              </thead>
              <tbody>
                {extractedData.map((record, index) => (
                  <tr key={index} className="table-row">
                    <td className="td-center">{index + 1}</td>
                    <td className="td">
                      <div className="cell-with-copy">
                        <span>{record.projectName}</span>
                        <button 
                          onClick={() => copyToClipboard(record.projectName, 'Project name')}
                          className="copy-btn"
                          title="Copy project name"
                        >
                          📋
                        </button>
                      </div>
                      {record.url && record.url !== '#' && (
                        <a href={record.url} target="_blank" rel="noopener noreferrer" className="link">
                          🔗 View Details
                        </a>
                      )}
                    </td>
                    <td className="td">
                      <div className="cell-with-copy">
                        <span>{record.promoterName}</span>
                        <button 
                          onClick={() => copyToClipboard(record.promoterName, 'Promoter name')}
                          className="copy-btn"
                          title="Copy promoter name"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td className="td">
                      <code className="registration-code">{record.registrationNumber}</code>
                    </td>
                    <td className="td">{record.district}</td>
                    <td className="td">
                      <span className={`status-badge status-${record.status?.toLowerCase() || 'registered'}`}>
                        {record.status || 'Registered'}
                      </span>
                    </td>
                    <td className="td">{new Date(record.extractedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;