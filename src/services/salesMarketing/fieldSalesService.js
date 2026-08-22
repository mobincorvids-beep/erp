/**
 * FieldSalesService — the sales-rep-app backend (spec §15): plan a visit,
 * check in/out with real GPS, and — the actual point of a field visit —
 * create a real order or collect a real payment while on-site, reusing
 * the exact same salesOrderService/customerLedgerService paths a
 * counter or office transaction already goes through. A FieldVisit
 * never carries its own copy of order/payment logic, only a link to
 * whichever real Sale/payment happened during it.
 */
const FieldVisit = require('../../models/FieldVisit');
const salesOrderService = require('../salesOrderService');
const customerLedgerService = require('../customerLedgerService');

function planVisit(input) {
  const { companyId, salespersonId, customerId } = input;
  if (!salespersonId || !customerId) throw new Error('salespersonId and customerId are required.');
  return FieldVisit.create({ ...input, companyId, status: input.plannedDate ? 'planned' : 'checked_in' });
}

async function checkIn(visitId, { lat, lng }) {
  const visit = await FieldVisit.findById(visitId);
  if (!visit) throw new Error('Field visit not found.');
  if (visit.status === 'completed') throw new Error('This visit is already completed.');
  visit.checkIn = { lat, lng, recordedAt: new Date() };
  visit.status = 'checked_in';
  await visit.save();
  return visit;
}

async function checkOut(visitId, { lat, lng, notes, photoUrls, signatureUrl }) {
  const visit = await FieldVisit.findById(visitId);
  if (!visit) throw new Error('Field visit not found.');
  if (!visit.checkIn) throw new Error('Cannot check out of a visit that was never checked into.');
  visit.checkOut = { lat, lng, recordedAt: new Date() };
  if (notes) visit.notes = notes;
  if (photoUrls) visit.photoUrls = photoUrls;
  if (signatureUrl) visit.signatureUrl = signatureUrl;
  visit.status = 'completed';
  await visit.save();
  return visit;
}

/** A real sales order created mid-visit — genuinely the same salesOrderService.createSalesOrder every other order goes through, just linked back to the visit that produced it. */
async function createOrderDuringVisit(visitId, orderInput) {
  const visit = await FieldVisit.findById(visitId);
  if (!visit) throw new Error('Field visit not found.');
  const salesOrder = await salesOrderService.createSalesOrder({ ...orderInput, companyId: visit.companyId, customerId: visit.customerId });
  visit.saleId = salesOrder._id;
  await visit.save();
  return { visit, salesOrder };
}

/** A real payment collected mid-visit — the exact customerLedgerService.recordPayment every office payment already uses. */
async function collectPaymentDuringVisit(visitId, paymentInput) {
  const visit = await FieldVisit.findById(visitId);
  if (!visit) throw new Error('Field visit not found.');
  const payment = await customerLedgerService.recordPayment({ ...paymentInput, companyId: visit.companyId, customerId: visit.customerId });
  visit.paymentAmount = Math.round(((visit.paymentAmount || 0) + paymentInput.amount) * 100) / 100;
  await visit.save();
  return { visit, payment };
}

function listVisits(companyId, { salespersonId, customerId, status, from, to } = {}) {
  const filter = { companyId };
  if (salespersonId) filter.salespersonId = salespersonId;
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  if (from || to) filter.plannedDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  return FieldVisit.find(filter).populate('customerId', 'name phone address').sort({ plannedDate: 1 });
}

/** The spec's own §15 report list, computed from real visit records — planned vs. actually completed vs. missed, not self-reported. */
async function repProductivity(companyId, salespersonId, from, to) {
  const visits = await FieldVisit.find({
    companyId, salespersonId,
    ...(from || to ? { createdAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}),
  });
  const planned = visits.filter((v) => v.plannedDate).length;
  const completed = visits.filter((v) => v.status === 'completed').length;
  const missed = visits.filter((v) => v.status === 'missed').length;
  const totalCollected = Math.round(visits.reduce((sum, v) => sum + (v.paymentAmount || 0), 0) * 100) / 100;
  const salesFromVisits = visits.filter((v) => v.saleId).length;

  return { planned, completed, missed, salesFromVisits, totalCollected };
}

module.exports = { planVisit, checkIn, checkOut, createOrderDuringVisit, collectPaymentDuringVisit, listVisits, repProductivity };
