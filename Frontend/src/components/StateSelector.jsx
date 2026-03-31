import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import CircularProgress from '@mui/material/CircularProgress';
import api from '../services/api';

const StateSelector = ({ selectedState, onStateChange }) => {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStates();
  }, []);

  const loadStates = async () => {
    try {
      const response = await api.getStates();
      const stateOptions = response.data.states.map(state => ({
        value: state,
        label: state
      }));
      setStates(stateOptions);
    } catch (error) {
      console.error('Failed to load states:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <FormControl fullWidth>
      <FormLabel component="legend" sx={{ mb: 1, fontWeight: 'bold' }}>
        Select State
      </FormLabel>
      <Select
        options={states}
        value={selectedState}
        onChange={onStateChange}
        placeholder="Choose a state..."
        isSearchable
        styles={{
          control: (base) => ({
            ...base,
            minHeight: '45px',
            borderColor: '#4CAF50',
            '&:hover': {
              borderColor: '#45a049'
            }
          }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isFocused ? '#e8f5e9' : 'white',
            color: '#333',
            '&:active': {
              backgroundColor: '#c8e6c9'
            }
          })
        }}
      />
    </FormControl>
  );
};

export default StateSelector;