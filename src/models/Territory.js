const { Schema, model } = require('mongoose');

/**
 * A hierarchical sales geography — Country > Province > City > Area >
 * Territory > Zone > Route, per the spec's own list. Modeled as one
 * self-referencing collection with a `level` label rather than seven
 * separate collections, since every level needs the exact same
 * operations (assign a default salesperson, roll customers/leads/
 * opportunities up into it) — seven near-identical models would be the
 * kind of forced distinctness this codebase's own README repeatedly
 * argues against.
 */
const territorySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  level: {
    type: String,
    required: true,
    enum: ['country', 'province', 'city', 'area', 'territory', 'zone', 'route'],
  },
  parentId: { type: Schema.Types.ObjectId, ref: 'Territory', default: null }, // null = top-level
  // The default salesperson a new Lead/Customer in this territory is
  // assigned to when nothing more specific is set — real assignment on
  // any individual Lead/Opportunity/Customer can still override this.
  defaultSalespersonId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

territorySchema.index({ companyId: 1, parentId: 1 });

module.exports = model('Territory', territorySchema);
