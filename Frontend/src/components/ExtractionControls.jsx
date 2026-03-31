import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';

const ExtractionControls = ({ onExtract, onClear, loading, progress, hasData }) => {
  const [maxRecords, setMaxRecords] = useState(100);
  const [filters, setFilters] = useState({
    type: 'building',
    status: 'ongoing',
    region: 'panchkula'
  });

  const handleExtract = () => {
    onExtract(maxRecords, filters);
  };

  const handleClear = () => {
    onClear();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Extraction Settings
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Max Records"
            value={maxRecords}
            onChange={(e) => setMaxRecords(parseInt(e.target.value) || 0)}
            helperText="Number of records to extract"
            disabled={loading}
            InputProps={{ inputProps: { min: 1, max: 1000 } }}
          />
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Project Type</InputLabel>
            <Select
              value={filters.type}
              label="Project Type"
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              disabled={loading}
            >
              <MenuItem value="building">Building</MenuItem>
              <MenuItem value="normalLayout">Normal Layout</MenuItem>
              <MenuItem value="regularisationLayout">Regularisation Layout</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              disabled={loading}
            >
              <MenuItem value="ongoing">Ongoing</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="extended">Extended</MenuItem>
              <MenuItem value="withdrawn">Withdrawn</MenuItem>
              <MenuItem value="revoked">Revoked</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Region (Haryana)</InputLabel>
            <Select
              value={filters.region}
              label="Region (Haryana)"
              onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              disabled={loading}
            >
              <MenuItem value="panchkula">Panchkula</MenuItem>
              <MenuItem value="gurugram">Gurugram</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleExtract}
              disabled={loading}
              size="large"
              sx={{ minWidth: 150 }}
            >
              {loading ? 'Extracting...' : 'Start Extraction'}
            </Button>
            {hasData && (
              <Button
                variant="outlined"
                onClick={handleClear}
                disabled={loading}
                size="large"
                sx={{ minWidth: 100 }}
              >
                Clear Data
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>
      
      {loading && (
        <Box sx={{ width: '100%', mt: 3 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Extracting data, please wait...
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ExtractionControls;