const express = require('express');
const { list, resolve } = require('../controllers/alertController');

const router = express.Router();

router.get('/', list);
router.patch('/:id/resolve', resolve);

module.exports = router;
