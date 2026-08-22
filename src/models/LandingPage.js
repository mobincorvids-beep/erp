const { Schema, model } = require('mongoose');

/**
 * A public lead-capture form (spec §24) — landing page / contact /
 * get-a-quote / product-enquiry / demo / appointment / registration.
 * This app doesn't render an actual public landing page (that's real,
 * separate front-end/CMS work); what it provides is the real backend
 * half — a durable slug any external page can POST a submission to,
 * with genuine source/campaign attribution, which is the part that
 * actually needs a database and business logic behind it.
 */
const landingPageSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  slug: { type: String, required: true }, // public, not secret — this IS the public form's identifier, embedded in whatever page hosts it
  formType: {
    type: String,
    enum: ['contact', 'get_a_quote', 'product_enquiry', 'demo', 'appointment', 'registration'],
    default: 'contact',
  },
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' }, // real attribution — every Lead this form produces carries this back (see landingPageService.submit)
  isActive: { type: Boolean, default: true },
  submissionCount: { type: Number, default: 0 },
}, { timestamps: true });

landingPageSchema.index({ companyId: 1, slug: 1 }, { unique: true });

module.exports = model('LandingPage', landingPageSchema);
