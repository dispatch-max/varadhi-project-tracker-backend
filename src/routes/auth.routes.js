const router = require('express').Router()
const ctrl = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth.middleware')

router.post('/register', ctrl.register)
router.post('/login', ctrl.login)
router.post('/logout', ctrl.logout)
router.post('/forgot-password', ctrl.forgotPassword)
router.post('/reset-password', ctrl.resetPassword)

router.get('/invite/:token', ctrl.verifyInvite)
router.post('/accept-invite', ctrl.acceptInvite)

router.get('/me', protect, ctrl.getMe)
router.put('/change-password', protect, ctrl.changePassword)

module.exports = router
