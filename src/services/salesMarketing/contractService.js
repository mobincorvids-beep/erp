/**
 * ContractService — real approval reusing approvalService (spec §33),
 * exactly the pattern purchaseService already established for
 * PurchaseOrder ('one entityType per real approvable document', not a
 * new approval concept per document type).
 */
const SalesContract = require('../../models/SalesContract');
const approvalService = require('../approvalService');
const { nextDocumentNumber } = require('../numberingService');

function createContract(input) {
  const { customerId, lines, periodStart, periodEnd } = input;
  if (!customerId) throw new Error('customerId is required.');
  if (!lines || lines.length === 0) throw new Error('At least one line is required.');
  if (!periodStart || !periodEnd) throw new Error('periodStart and periodEnd are required.');
  return SalesContract.create({ ...input, contractNumber: nextDocumentNumber('CTR') });
}

function listContracts(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return SalesContract.find(filter).sort({ createdAt: -1 });
}

async function submitForApproval(contractId, userId) {
  const contract = await SalesContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (contract.status !== 'draft') throw new Error(`Cannot submit a contract with status "${contract.status}" for approval.`);

  const totalValue = contract.lines.reduce((sum, l) => sum + (l.quantity || 0) * (l.contractPrice || 0), 0);
  const approval = await approvalService.request({
    companyId: contract.companyId, entityType: 'SalesContract', entityId: contract._id, requestedBy: userId, amount: totalValue,
  });

  contract.status = 'pending_approval';
  contract.approvalRequestId = approval._id;
  await contract.save();
  return { contract, approval };
}

async function activate(contractId) {
  const contract = await SalesContract.findById(contractId);
  if (!contract) throw new Error('Contract not found.');
  if (contract.status !== 'pending_approval' && contract.status !== 'draft') {
    throw new Error(`Cannot activate a contract with status "${contract.status}".`);
  }
  contract.status = 'active';
  contract.signedAt = new Date();
  await contract.save();
  return contract;
}

async function amend(contractId, note, userId) {
  const contract = await SalesContract.findByIdAndUpdate(
    contractId,
    { $push: { amendments: { note, userId } } },
    { new: true }
  );
  if (!contract) throw new Error('Contract not found.');
  return contract;
}

async function terminate(contractId) {
  const contract = await SalesContract.findByIdAndUpdate(contractId, { status: 'terminated' }, { new: true });
  if (!contract) throw new Error('Contract not found.');
  return contract;
}

/** Used by a queue sweep — real, not-yet-flagged expired contracts (still 'active' past their own periodEnd). */
function findExpiring(companyId) {
  return SalesContract.find({ companyId, status: 'active', periodEnd: { $lte: new Date() } });
}

module.exports = { createContract, listContracts, submitForApproval, activate, amend, terminate, findExpiring };
