const jwt = require('jsonwebtoken')
const pool = require('../config/db')

exports.protect = async (req, res, next) => {
  try {
    let token
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }
     
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please login.' })
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    const result = await pool.query(
      'SELECT id, name, email, role, status FROM users WHERE id = $1',
      [decoded.id]
    )
    if (!result.rows[0]) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' })
    }
    if (result.rows[0].status === 'inactive') {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' })
    }
    req.user = result.rows[0]
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' })
  }
}

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      })
    }
    next()
  }
}
