

const router = require('express').Router()
const ctrl = require('../controllers/documents.controller')
const { protect } = require('../middleware/auth.middleware')
const upload = require('../middleware/upload')

router.use(protect)

router.get('/', ctrl.getAllDocuments)
router.post('/upload', upload.single('file'), ctrl.uploadDocument)
router.patch('/:id/move', ctrl.moveDocument)
router.get('/:id/download', ctrl.downloadDocument)
router.delete('/:id', ctrl.deleteDocument)

module.exports = router