const router = require('express').Router()
const pool = require('../config/db')
const { protect } = require('../middleware/auth.middleware')
const { successResponse, errorResponse } = require('../utils/response')
router.use(protect)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.id])
    return successResponse(res, result.rows)
  } catch (err) { return errorResponse(res, err.message, 500) }
})
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])
    return successResponse(res, null, 'Marked as read.')
  } catch (err) { return errorResponse(res, err.message, 500) }
})
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id])
    return successResponse(res, null, 'All marked as read.')
  } catch (err) { return errorResponse(res, err.message, 500) }
})
module.exports = router
