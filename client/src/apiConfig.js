// API Configuration for MMPZ System
// Uses relative path to ensure compatibility with both Netlify Dev (8888) and Production

// Always use relative path. 
// - On localhost:8888, Netlify Dev proxies /api to functions
// - On production, Netlify proxies /api to functions
// - On localhost:5173, Vite proxy (configured in vite.config.js) forwards /api to 8888
export const API_BASE = '/api';

export default API_BASE;
