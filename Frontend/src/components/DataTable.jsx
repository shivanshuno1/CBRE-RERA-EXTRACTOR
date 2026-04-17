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
import VisibilityIcon from '@mui/icons-material/Visibility';
import { toast } from 'react-hot-toast';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

const DataTable = ({ data }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedProject, setSelectedProject] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    if (s === 'expired') return 'warning';
    return 'default';
  };

  const handleViewDetails = (project) => {
    setSelectedProject(project);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
  };

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
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
                <TableCell sx={{ fontWeight: 'bold' }}>📍 Location</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Extracted At</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((row, idx) => (
                <TableRow hover key={idx}>
                  <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {row.projectName}
                      <Tooltip title="Copy project name">
                        <IconButton size="small" onClick={() => copyToClipboard(row.projectName, 'Project name')}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>{row.promoterName}</TableCell>
                  <TableCell>
                    <Chip label={row.registrationNumber} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                  </TableCell>
                  <TableCell>{row.district}</TableCell>
                  <TableCell>
                    <Chip label={row.status} color={getStatusColor(row.status)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={row.locationOfSite || 'Not available'}>
                      <span>{(row.locationOfSite || '—').substring(0, 40)}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {row.extractedAt ? new Date(row.extractedAt).toLocaleString() : 'Invalid Date'}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View all details">
                      <IconButton onClick={() => handleViewDetails(row)} color="primary">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
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

      {/* Modal for detailed view */}
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          maxWidth: 900,
          maxHeight: '80vh',
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
          overflow: 'auto'
        }}>
          {selectedProject && (
            <>
              <Typography variant="h6" gutterBottom>Project Details</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle1" fontWeight="bold">Project Name</Typography>
              <Typography paragraph>{selectedProject.projectName}</Typography>
              <Typography variant="subtitle1" fontWeight="bold">Promoter Name & Address</Typography>
              <Typography paragraph>{selectedProject.promoterName}</Typography>
              <Typography variant="subtitle1" fontWeight="bold">Registration Number</Typography>
              <Typography paragraph>{selectedProject.registrationNumber}</Typography>
              {selectedProject.projectDetails && selectedProject.projectDetails !== 'N/A' && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold">Project Details & Approval</Typography>
                  <Typography paragraph>{selectedProject.projectDetails}</Typography>
                </>
              )}
              {selectedProject.approvalDetails && selectedProject.approvalDetails !== 'N/A' && selectedProject.approvalDetails !== selectedProject.projectDetails && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold">Approval Details</Typography>
                  <Typography paragraph>{selectedProject.approvalDetails}</Typography>
                </>
              )}
              {selectedProject.locationOfSite && selectedProject.locationOfSite !== 'N/A' && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold">Location of Site (Coordinates)</Typography>
                  <Typography paragraph>{selectedProject.locationOfSite}</Typography>
                </>
              )}
              {selectedProject.projectCompletionDate && selectedProject.projectCompletionDate !== 'N/A' && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold">Project Completion Date</Typography>
                  <Typography paragraph>{selectedProject.projectCompletionDate}</Typography>
                </>
              )}
              {selectedProject.otherDetails && selectedProject.otherDetails !== 'N/A' && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold">Other Details</Typography>
                  <Typography paragraph>{selectedProject.otherDetails}</Typography>
                </>
              )}
              {selectedProject.year && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold">Year</Typography>
                  <Typography paragraph>{selectedProject.year}</Typography>
                </>
              )}
              <Typography variant="subtitle1" fontWeight="bold">District</Typography>
              <Typography paragraph>{selectedProject.district}</Typography>
              <Typography variant="subtitle1" fontWeight="bold">Status</Typography>
              <Typography paragraph>{selectedProject.status}</Typography>
              <Typography variant="subtitle1" fontWeight="bold">Extracted At</Typography>
              <Typography paragraph>{new Date(selectedProject.extractedAt).toLocaleString()}</Typography>
              {selectedProject.url && selectedProject.url !== 'N/A' && (
                <Box sx={{ mt: 2 }}>
                  <Tooltip title="Open original page">
                    <IconButton component="a" href={selectedProject.url} target="_blank" color="primary">
                      <OpenInNewIcon /> View Original Page
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </>
          )}
        </Box>
      </Modal>
    </>
  );
};

export default DataTable;