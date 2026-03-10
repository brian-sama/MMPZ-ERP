// Response helper utilities for function-style API handlers.

/**
 * Create a successful JSON response
 * @param {*} data - Data to return
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Function response object
 */
export const successResponse = (data, statusCode = 200) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Configure this for production
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        },
        body: JSON.stringify(data),
    };
};

/**
 * Create an error JSON response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {*} details - Additional error details
 * @returns {Object} Function response object
 */
export const errorResponse = (message, statusCode = 500, details = null) => {
    const errorBody = {
        error: message,
    };

    if (details) {
        errorBody.details = details;
    }

    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        },
        body: JSON.stringify(errorBody),
    };
};

/**
 * Handle OPTIONS requests for CORS preflight
 * @returns {Object} Function response object
 */
export const corsResponse = () => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        },
        body: '',
    };
};

/**
 * Parse request body (handles JSON, URL-encoded, and base64)
 * @param {Object} event - Handler event object
 * @returns {Object} Parsed body
 */
export const parseBody = (event) => {
    if (!event.body) return {};

    try {
        const body = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64').toString()
            : event.body;
        return JSON.parse(body);
    } catch (error) {
        console.error('Error parsing body:', error);
        return {};
    }
};

/**
 * Extract query parameters from event
 * @param {Object} event - Handler event object
 * @returns {Object} Query parameters
 */
export const getQueryParams = (event) => {
    return event.queryStringParameters || {};
};

/**
 * Extract path parameters from event
 * @param {Object} event - Handler event object
 * @param {string} paramName - Name of the path parameter
 * @returns {string|null} Parameter value
 */
export const getPathParam = (event, paramName) => {
    // 1. Check mapped path parameters first.
    if (event.pathParameters && event.pathParameters[paramName]) {
        return event.pathParameters[paramName];
    }

    // 2. Fallback to manual path parsing
    const path = event.path || '';
    const parts = path.split('/').filter(Boolean);

    // Look for ID at the end if we are looking for 'id'
    if (paramName === 'id' || paramName === 'indicatorId') {
        const lastPart = parts[parts.length - 1];
        const resourceNames = ['indicators', 'activities', 'users', 'progress', 'kobo', 'config', 'link', 'sync'];
        if (!resourceNames.includes(lastPart)) {
            return lastPart;
        }
    }

    const index = parts.indexOf(paramName);
    return (index !== -1 && parts[index + 1]) ? parts[index + 1] : null;
};
