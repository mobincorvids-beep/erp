/**
 * SalesActivityService — the central activity engine (spec §5/§6): every
 * call/WhatsApp/email/meeting/demo/visit/follow-up against a Lead,
 * Opportunity, Customer, or Sale (quotation/order) goes through here.
 */
const SalesActivity = require('../../models/SalesActivity');
const Opportunity = require('../../models/Opportunity');
const { SALES_ACTIVITY_ENTITY_TYPES } = require('../../constants/salesMarketing');

async function logActivity(input) {
  const { companyId, type, entityType, entityId, subject, dueAt } = input;
  if (!SALES_ACTIVITY_ENTITY_TYPES.includes(entityType)) throw new Error(`Invalid activity entityType: ${entityType}`);
  if (!subject) throw new Error('Activity subject is required.');

  const activity = await SalesActivity.create({ ...input, companyId, type, entityType, entityId, subject, dueAt });

  // Bumping Opportunity.lastActivityAt here (rather than making the caller
  // remember to) is what keeps "stage aging" / "no activity in N days"
  // reports honest without a second query over this collection every time.
  if (entityType === 'Opportunity') {
    await Opportunity.findByIdAndUpdate(entityId, { lastActivityAt: new Date() });
  }
  return activity;
}

function listForEntity(companyId, entityType, entityId) {
  return SalesActivity.find({ companyId, entityType, entityId }).sort({ createdAt: -1 }).limit(200);
}

async function completeActivity(activityId, outcome) {
  const activity = await SalesActivity.findByIdAndUpdate(
    activityId, { completedAt: new Date(), outcome }, { new: true }
  );
  if (!activity) throw new Error('Sales activity not found.');
  return activity;
}

/** The spec §6 dashboard's own bucket list, computed as one real query set, not five separate hand-written filters scattered across controllers. */
async function followUpDashboard(companyId, userId) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const base = { companyId, assignedTo: userId, completedAt: null, dueAt: { $ne: null } };

  const [todayFollowUps, overdueFollowUps, upcomingFollowUps] = await Promise.all([
    SalesActivity.find({ ...base, dueAt: { $gte: todayStart, $lte: todayEnd } }).sort({ dueAt: 1 }),
    SalesActivity.find({ ...base, dueAt: { $lt: todayStart } }).sort({ dueAt: 1 }),
    SalesActivity.find({ ...base, dueAt: { $gt: todayEnd } }).sort({ dueAt: 1 }).limit(50),
  ]);

  const Lead = require('../../models/Lead');
  const [hotLeads, hotOpportunities] = await Promise.all([
    Lead.find({ companyId, rating: 'hot', status: { $nin: ['won', 'lost'] } }).sort({ score: -1 }).limit(20),
    Opportunity.find({ companyId, stage: { $nin: ['won', 'lost'] }, probability: { $gte: 70 } }).sort({ expectedValue: -1 }).limit(20),
  ]);

  return { todayFollowUps, overdueFollowUps, upcomingFollowUps, hotLeads, hotOpportunities };
}

/** Used by the queue's scheduled sweep (see queue/jobs.js) — every company's overdue/due-today follow-ups that haven't already been reminded about, fired as real Notifications rather than requiring someone to open the dashboard to notice. */
async function findDueTodayOrOverdue(companyId) {
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  return SalesActivity.find({ companyId, completedAt: null, reminderSentAt: null, dueAt: { $ne: null, $lte: todayEnd } });
}

async function markReminded(activityId) {
  await SalesActivity.findByIdAndUpdate(activityId, { reminderSentAt: new Date() });
}

module.exports = { logActivity, listForEntity, completeActivity, followUpDashboard, findDueTodayOrOverdue, markReminded };
