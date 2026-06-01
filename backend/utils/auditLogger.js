const db = require('../config/db');

/**
 * Logs a secure staff transition or access incident directly inside the audit database ledger.
 * This process is non-blocking to request lifecycles.
 * 
 * @param {number|null} userId - The unique ID of the staff user (if authenticated).
 * @param {string} action - Action descriptor (e.g. 'FAILED_LOGIN_ATTEMPT', 'PASSWORD_RESET_SUCCESS').
 * @param {object} req - Express Request object to extract IP and User-Agent headers.
 * @param {string|null} details - Volumetric context or metadata describing the incident.
 */
async function logSecurityEvent(userId, action, req, details = null) {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      // Resolve client IP through proxies or load balancers safely
      ipAddress = req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(',')[0].trim() 
        : (req.ip || req.connection?.remoteAddress || null);
        
      userAgent = req.headers['user-agent'] || null;
    }

    // Parameterized SQL query to prevent SQL injections on security entries
    await db.query(`
      INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?)
    `, [userId || null, action, ipAddress, userAgent, details]);

  } catch (error) {
    // Non-blocking log trace in event of db transaction collision
    console.error('==================================================');
    console.error('CRITICAL: Audit Logger failed to write secure event!');
    console.error('Error Details:', error.message);
    console.error('Failed Event:', { userId, action, details });
    console.error('==================================================');
  }
}

module.exports = {
  logSecurityEvent
};
