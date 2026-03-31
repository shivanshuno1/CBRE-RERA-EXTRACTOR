import React from 'react';
import Button from '@mui/material/Button';
import DownloadIcon from '@mui/icons-material/Download';

const DownloadButton = ({ onDownload }) => {
  return (
    <Button
      variant="contained"
      color="secondary"
      startIcon={<DownloadIcon />}
      onClick={onDownload}
      sx={{ 
        textTransform: 'none',
        fontWeight: 'bold',
        px: 3,
        py: 1
      }}
    >
      Download as Excel
    </Button>
  );
};

export default DownloadButton;