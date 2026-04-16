import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { toast } from 'react-hot-toast';
import Box from '@mui/material/Box';

const DataTable = ({ data }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  if (!data || data.length === 0) {
    return (
      <Paper sx={{ width: '100%', p: 4, textAlign: 'center' }}>
        No data available. Run extraction.
      </Paper>
    );
  }

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    toast.success(`${field} copied`);
  };

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s === 'ongoing' || s === 'registered') return 'success';
    if (s === 'completed') return 'info';
    if (s === 'withdrawn' || s === 'revoked') return 'error';
    return 'default';
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>S.No</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Project Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Promoter Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Registration No.</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>District</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Extracted At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, idx) => (
              <TableRow hover key={idx}>
                <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {row.projectName}
                    <Tooltip title="Copy">
                      <IconButton size="small" onClick={() => copyToClipboard(row.projectName, 'Project name')}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {row.url && (
                      <Tooltip title="View">
                        <IconButton size="small" component="a" href={row.url} target="_blank">
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell>{row.promoterName}</TableCell>
                <TableCell>
                  <Chip label={row.registrationNumber} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{row.district}</TableCell>
                <TableCell>
                  <Chip label={row.status || 'Registered'} color={getStatusColor(row.status)} size="small" />
                </TableCell>
                <TableCell>
                  {row.extractedAt ? new Date(row.extractedAt).toLocaleString() : 'Invalid Date'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default DataTable;