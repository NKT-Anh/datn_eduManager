import React from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';

const LoadingOverlay: React.FC<{ open: boolean; text?: string }> = ({ open, text }) => {
  if (!open) return null;
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <CircularProgress sx={{ color: 'white', mb: 2 }} />
      <Typography variant="h6" color="white">
        {text || 'Đang xử lý...'}
      </Typography>
    </Box>
  );
};

export default LoadingOverlay;
