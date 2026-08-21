const Territory = require('../../models/Territory');

function createTerritory(input) {
  return Territory.create(input);
}

function listTerritories(companyId, { level, parentId } = {}) {
  const filter = { companyId };
  if (level) filter.level = level;
  if (parentId !== undefined) filter.parentId = parentId || null;
  return Territory.find(filter).sort({ name: 1 });
}

async function updateTerritory(territoryId, patch) {
  const territory = await Territory.findByIdAndUpdate(territoryId, patch, { new: true });
  if (!territory) throw new Error('Territory not found.');
  return territory;
}

/** The full ancestor->descendant tree in one pass — a real recursive assembly, not N+1 queries per level, since a territory hierarchy is rarely deep enough to need graph-lookup aggregation but is exactly the kind of thing that's easy to accidentally write as N+1. */
async function tree(companyId) {
  const all = await Territory.find({ companyId }).sort({ name: 1 }).lean();
  const byParent = new Map();
  for (const t of all) {
    const key = t.parentId ? String(t.parentId) : 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(t);
  }
  function attach(node) {
    node.children = (byParent.get(String(node._id)) || []).map(attach);
    return node;
  }
  return (byParent.get('root') || []).map(attach);
}

module.exports = { createTerritory, listTerritories, updateTerritory, tree };
