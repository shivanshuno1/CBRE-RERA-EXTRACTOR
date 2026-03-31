import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [selectedState, setSelectedState] = useState('');
  const [maxRecords, setMaxRecords] = useState(100);
  const [extractedData, setExtractedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [states, setStates] = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [filters, setFilters] = useState({
    type: 'building',       // for Tamil Nadu
    status: 'ongoing',      // for Madhya Pradesh
    region: 'panchkula'     // for Haryana
  });

  // Load states from backend
  useEffect(() => {
    loadStates();
  }, []);

  const loadStates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/scraper/states`, {
        timeout: 5000
      });
      setStates(response.data.states);
      setBackendConnected(true);
      showMessage('Connected to backend successfully!', 'success');
    } catch (error) {
      console.error('Failed to load states:', error);
      setBackendConnected(false);
      showMessage('Cannot connect to backend. Make sure server is running on port 5000', 'error');
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
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
        filters: filters
      });

      if (response.data.success) {
        setExtractedData(response.data.data);
        showMessage(`✅ Extracted ${response.data.records} records from ${selectedState}`, 'success');
      } else {
        showMessage('Extraction failed', 'error');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      showMessage(error.response?.data?.error || error.message, 'error');
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
      link.setAttribute('download', `rera_${selectedState.replace(/\s/g, '_')}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      showMessage('📥 File downloaded', 'success');
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

  // Filter options for specific states
  const renderStateSpecificFilters = () => {
    if (selectedState === 'Tamil Nadu') {
      return (
        <div className="form-group">
          <label className="label">Project Type:</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="select"
          >
            <option value="building">Building Projects</option>
            <option value="normalLayout">Normal Layout Projects</option>
            <option value="regularisationLayout">Regularisation Layout Projects</option>
          </select>
        </div>
      );
    }

    if (selectedState === 'Madhya Pradesh') {
      return (
        <div className="form-group">
          <label className="label">Project Status:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="select"
          >
            <option value="ongoing">Ongoing Projects</option>
            <option value="completed">Completed Projects</option>
            <option value="extended">Extended Projects</option>
            <option value="withdrawn">Withdrawn Projects</option>
            <option value="revoked">Revoked Projects</option>
          </select>
        </div>
      );
    }

    if (selectedState === 'Haryana') {
      return (
        <div className="form-group">
          <label className="label">Region:</label>
          <select
            value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value })}
            className="select"
          >
            <option value="panchkula">Panchkula</option>
            <option value="gurugram">Gurugram</option>
          </select>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="container">
      {!backendConnected && (
        <div className="connection-warning">
          ⚠️ Cannot connect to backend. Please start the server with: node server.js
        </div>
      )}
      
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
            disabled={!backendConnected}
          >
            <option value="">-- Choose a state --</option>
            {states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        {renderStateSpecificFilters()}

        <div className="form-group">
          <label className="label">Max Records:</label>
          <input 
            type="number" 
            value={maxRecords} 
            onChange={(e) => setMaxRecords(e.target.value)}
            className="input"
            min="1"
            max="1000"
            disabled={!backendConnected}
          />
          <span className="helper-text">Number of records to extract (max 1000)</span>
        </div>

        <div className="button-group">
          <button 
            onClick={handleExtract} 
            disabled={loading || !selectedState || !backendConnected}
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
                📥 Download Excel
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
                      {record.url && record.url !== 'N/A' && (
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