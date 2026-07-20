const router = require('express').Router()
const ctrl = require('../controllers/folders.controller')
const { protect, restrictTo } = require('../middleware/auth.middleware')

router.use(protect)

router.get('/', ctrl.getAllFolders)
router.post('/', restrictTo('admin', 'manager'), ctrl.createFolder)
// router.post('/', ctrl.createFolder)
router.patch('/:id', restrictTo('admin', 'manager'), ctrl.renameFolder)
router.delete('/:id', restrictTo('admin', 'manager'), ctrl.deleteFolder)

module.exports = router