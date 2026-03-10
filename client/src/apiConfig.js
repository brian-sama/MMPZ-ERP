// API Configuration for MMPZ System
// Uses relative path so frontend and backend stay environment-agnostic.

// Always use relative path. 
// - On localhost:5173, Vite proxy (configured in vite.config.js) forwards /api to backend server
// - In production, reverse proxy can forward /api to the deployed backend
export const API_BASE = '/api';

export default API_BASE;
