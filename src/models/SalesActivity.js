const { Schema, model } = require('mongoose');
const { SALES_ACTIVITY_TYPES, SALES_ACTIVITY_ENTITY_TYPES } = require('../constants/salesMarketing');

/**
 * The central activity engine (spec §5) — every call/WhatsApp/email/
 * meeting/demo/visit/follow-up/task/reminder/note against a Lead,
 * Opportunity, Customer, Quotation, or SalesOrder is one record in this
 * one collection, not a different table per entity type. Polymorphic via
 * (entityType, entityId) — the same pattern src/models/Document.js already
 * established for attachments, reused here rather than invented fresh.
 */
const salesActivitySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  type: { type: String, enum: SALES_ACTIVITY_TYPES, required: true },

  entityType: { type: String, enum: SALES_ACTIVITY_ENTITY_TYPES, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },

  subject: { type: String, required: true },
  notes: String,

  // Follow-up/task/reminder-shaped activities carry a due date and a
  // completion state; a call/note logged after the fact typically has
  // neither set (dueAt null, completedAt === createdAt implicitly). Both
  // optional rather than two different schemas, since the difference is a
  // handful of fields, not a different shape.
  dueAt: Date,
  completedAt: Date,
  outcome: String, // free text — "left voicemail", "interested, wants a demo", etc.
  // Set once the due/overdue sweep (queue/jobs.js: sweep.salesFollowUpReminders)
  // has fired a Notification for this activity — the same "notify once,
  // don't spam a fresh alert on every sweep run" dedup Document expiry and
  // low-stock checks already use elsewhere in this app.
  reminderSentAt: Date,

  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

salesActivitySchema.index({ companyId: 1, entityType: 1, entityId: 1, createdAt: -1 });
salesActivitySchema.index({ companyId: 1, assignedTo: 1, dueAt: 1, completedAt: 1 }); // the "my today's / overdue follow-ups" query, spec §6's dashboard

module.exports = model('SalesActivity', salesActivitySchema);
