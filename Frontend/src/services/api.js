import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = {
  extractData: async (state, maxRecords, filters) => {
    return axios.post(`${API_BASE_URL}/scraper/extract`, {
      state,
      maxRecords,
      filters
    });
  },

  getStates: async () => {
    return axios.get(`${API_BASE_URL}/scraper/states`);
  },

  downloadExcel: async (data, state) => {
    return axios.post(`${API_BASE_URL}/scraper/download`, {
      data,
      state
    }, {
      responseType: 'blob'
    });
  }
};

export default api;