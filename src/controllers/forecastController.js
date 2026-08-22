const forecastService = require('../services/salesMarketing/forecastService');

async function pipeline(req, res) {
  const { salespersonId, territoryId } = req.query;
  res.json(await forecastService.pipelineForecast(req.companyId, { salespersonId, territoryId }));
}

async function historical(req, res) {
  const monthsBack = req.query.monthsBack ? Number(req.query.monthsBack) : 6;
  res.json(await forecastService.historicalForecast(req.companyId, monthsBack));
}

module.exports = { pipeline, historical };
