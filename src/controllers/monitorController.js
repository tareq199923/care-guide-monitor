const monitorService = require('../services/monitorService');

async function monitor(req, res) {
  const summary = await monitorService.processBatch(req.body);
  res.status(200).json(summary);
}

module.exports = { monitor };
