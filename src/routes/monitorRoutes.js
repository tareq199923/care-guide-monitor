const express = require('express');
const validateBatch = require('../middleware/validateBatch');
const { monitor } = require('../controllers/monitorController');

const router = express.Router();

router.post('/', validateBatch, monitor);

module.exports = router;
