// const router = require('express').Router()
// const multer = require('multer')
// const path = require('path')
// const ctrl = require('../controllers/documents.controller')
// const { protect } = require('../middleware/auth.middleware')
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, 'uploads/'),
//   filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1e9) + path.extname(file.originalname))
// })
// const upload = multer({ storage, limits: { fileSize: 10*1024*1024 },
//   fileFilter: (req, file, cb) => {
//     const allowed = ['.pdf','.doc','.docx','.xls','.xlsx','.png','.jpg','.jpeg','.zip']
//     if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
//     else cb(new Error('File type not allowed.'))
//   }
// })
// router.use(protect)
// router.get('/', ctrl.getAllDocuments)
// router.post('/upload', upload.single('file'), ctrl.uploadDocument)
// router.delete('/:id', ctrl.deleteDocument)
// router.get('/:id/download', ctrl.downloadDocument)
// module.exports = router

const router = require('express').Router()
const ctrl = require('../controllers/documents.controller')
const { protect } = require('../middleware/auth.middleware')
const upload = require('../middleware/upload')

router.use(protect)

router.get('/', ctrl.getAllDocuments)
router.post('/upload', upload.single('file'), ctrl.uploadDocument)
router.get('/:id/download', ctrl.downloadDocument)
router.delete('/:id', ctrl.deleteDocument)

module.exports = router