/**
 * Shared enums for the Sales & Marketing suite (Leads, Opportunities,
 * Campaigns, Partners...) — centralized the same way src/constants/
 * industries.js and permissions.js already are, so a model, its service,
 * and its controller/report never risk drifting out of sync on what a
 * valid value actually is.
 */
const LEAD_SOURCES = [
  'website', 'landing_page', 'facebook', 'instagram', 'whatsapp', 'google', 'tiktok', 'linkedin',
  'email', 'phone', 'walk_in', 'referral', 'existing_customer', 'salesperson', 'dealer',
  'distributor', 'event', 'exhibition', 'campaign', 'qr_code', 'import', 'api',
];

const LEAD_STATUSES = [
  'new', 'contacted', 'qualified', 'interested', 'opportunity', 'quotation', 'negotiation', 'won', 'lost',
];

// Statuses that count as "already qualified enough to weight into a
// pipeline forecast" — used by leadService and forecastService so the two
// don't disagree about where the qualification line is.
const LEAD_QUALIFIED_STATUSES = ['qualified', 'interested', 'opportunity', 'quotation', 'negotiation'];

const OPPORTUNITY_STAGES = ['new', 'qualification', 'discovery', 'proposal', 'negotiation', 'approval', 'won', 'lost'];

// Default win-probability per stage, used only as the STARTING probability
// when an opportunity enters a stage — a user can always override it with
// a real, deal-specific number. Numbers are a defensible, stated
// judgment call (roughly matching common CRM defaults), not derived from
// this platform's own historical data (there isn't any yet for a new
// company), documented here so the choice is visible, not buried.
const OPPORTUNITY_STAGE_DEFAULT_PROBABILITY = {
  new: 10, qualification: 20, discovery: 35, proposal: 55, negotiation: 70, approval: 85, won: 100, lost: 0,
};

const SALES_ACTIVITY_TYPES = [
  'call', 'whatsapp', 'email', 'sms', 'meeting', 'demo', 'site_visit', 'sales_visit',
  'follow_up', 'task', 'reminder', 'note', 'appointment', 'video_meeting',
];

// Every entity type a SalesActivity is allowed to attach to — enforced in
// salesActivityService so a typo'd entityType doesn't silently create an
// activity that no Customer 360 / Lead / Opportunity view will ever find.
// NOTE: a "Quotation" and a "Sales Order" are NOT separate models in this
// codebase — both are a Sale document distinguished by saleType/status
// (see models/Sale.js and services/salesOrderService.js). Using 'Sale'
// here rather than inventing 'Quotation'/'SalesOrder' entity types avoids
// the exact kind of duplicate-model mistake this codebase's own README
// flags repeatedly (e.g. the FleetVehicle/Ticket naming-collision lessons).
const SALES_ACTIVITY_ENTITY_TYPES = ['Lead', 'Opportunity', 'Customer', 'Sale'];

const CAMPAIGN_CHANNELS = [
  'facebook', 'instagram', 'google', 'youtube', 'tiktok', 'linkedin',
  'email', 'sms', 'whatsapp', 'website', 'search', 'offline', 'events', 'referral',
];

const MARKETING_AUTOMATION_TRIGGERS = [
  'lead_created', 'quote_created', 'quote_expired', 'quote_accepted', 'abandoned_cart',
  'first_purchase', 'repeat_purchase', 'birthday', 'anniversary', 'membership_expiry',
  'subscription_expiry', 'invoice_overdue', 'customer_inactive', 'product_back_in_stock',
];

module.exports = {
  LEAD_SOURCES, LEAD_STATUSES, LEAD_QUALIFIED_STATUSES,
  OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_DEFAULT_PROBABILITY,
  SALES_ACTIVITY_TYPES, SALES_ACTIVITY_ENTITY_TYPES,
  CAMPAIGN_CHANNELS, MARKETING_AUTOMATION_TRIGGERS,
};
