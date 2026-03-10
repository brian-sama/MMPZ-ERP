// Authentication helper utilities.
import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare a password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
export const comparePassword = async (password, hash) => {
    if (!hash || !password) return false;

    // Check if hash is bcrypt format (starts with $2)
    if (hash.startsWith('$2')) {
        return await bcrypt.compare(password, hash);
    }

    // Legacy comparison removed for security. 
    // All users created through the app use bcrypt.
    return false;
};

/**
 * Verify user has required role
 * @param {string} userRole - User's role
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {boolean} True if user has permission
 */
export const hasRole = (userRole, allowedRoles) => {
    return allowedRoles.includes(userRole);
};

/**
 * Check if user is admin
 * @param {string} userRole - User's role
 * @returns {boolean} True if user is admin
 */
export const isAdmin = (userRole) => {
    return userRole === 'admin';
};

/**
 * Check if user is admin or director
 * @param {string} userRole - User's role
 * @returns {boolean} True if user is admin or director
 */
export const isAdminOrDirector = (userRole) => {
    return userRole === 'admin' || userRole === 'director';
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if email is valid
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return {
            isValid: false,
            message: 'Password must be at least 6 characters long',
        };
    }
    return {
        isValid: true,
        message: 'Password is valid',
    };
};
