const territoryService = require('../services/salesMarketing/territoryService');

async function create(req, res) {
  try {
    const territory = await territoryService.createTerritory({ ...req.body, companyId: req.companyId });
    res.status(201).json(territory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { level, parentId } = req.query;
  const territories = await territoryService.listTerritories(req.companyId, { level, parentId });
  res.json(territories);
}

async function tree(req, res) {
  res.json(await territoryService.tree(req.companyId));
}

async function update(req, res) {
  try {
    const territory = await territoryService.updateTerritory(req.params.id, req.body);
    res.json(territory);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, tree, update };
