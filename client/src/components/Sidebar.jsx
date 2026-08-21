import { NavLink } from 'react-router-dom';
import {
  ShoppingCart, Package, Wallet, Users, BarChart3, Building2, LogOut,
  CreditCard, Receipt, FileText, CalendarClock, Wrench, Boxes, ArrowLeftRight,
  ClipboardList, Factory, Banknote, Landmark, FolderKanban, PieChart,
  Contact, Truck, UserCog, HeartHandshake, Gift, Sparkles, Store, Circle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';

// One icon per nav item — a real, intentional choice per destination
// rather than a generic bullet, so the sidebar can be scanned visually,
// not just read line by line. Anything not explicitly mapped (mainly the
// 22 industry-module links, where a single shared icon per link would be
// more noise than signal at that volume) falls back to a plain dot rather
// than rendering a missing/broken icon.
const ITEM_ICONS = {
  '/pos': CreditCard, '/sales': Receipt, '/sales-workflow': FileText,
  '/appointments': CalendarClock, '/service-orders': Wrench,
  '/products': Boxes, '/purchases': ClipboardList, '/stock-transfers': ArrowLeftRight,
  '/stock-counts': Package, '/manufacturing': Factory,
  '/expenses': Banknote, '/banking': Landmark, '/projects': FolderKanban, '/reports': PieChart,
  '/customers': Contact, '/suppliers': Truck, '/team': UserCog, '/hr': Users,
  '/crm': HeartHandshake, '/loyalty': Gift,
  '/ai-insights': Sparkles, '/ecommerce': Store,
};

const SECTION_ICONS = { Sell: ShoppingCart, Stock: Package, Money: Wallet, People: Users, Insights: BarChart3, Industry: Building2 };

// Grouped by workflow proximity, not by backend module name — a cashier
// thinks "Sell", not "PosSaleService". Each item optionally declares
// `requires` — a permission key checked against the real, backend-enforced
// permission catalog (src/constants/permissions.js) via useAuth().can().
// An item with no `requires` is available to anyone signed in (checkout
// itself needs pos.sell to actually complete a sale server-side, but
// browsing to it isn't gated — genuinely open items like Sales history
// were left ungated deliberately here rather than guessed at).
const SECTIONS = [
  {
    label: 'Sell',
    items: [
      { to: '/pos', label: 'Checkout', requires: 'pos.sell' },
      { to: '/sales', label: 'Sales history', requires: 'sales.view' },
      { to: '/sales-workflow', label: 'Quotations & orders', requires: 'sales.view' },
      { to: '/appointments', label: 'Appointments' },
      { to: '/service-orders', label: 'Service orders', requires: 'service_orders.manage' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { to: '/products', label: 'Products' },
      { to: '/purchases', label: 'Purchase orders', requires: 'purchases.create' },
      { to: '/stock-transfers', label: 'Transfers', requires: 'inventory.transfer' },
      { to: '/stock-counts', label: 'Stocktakes', requires: 'inventory.adjust' },
      { to: '/manufacturing', label: 'Manufacturing', requires: 'manufacturing.manage' },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/expenses', label: 'Expenses', requires: 'expenses.submit' },
      { to: '/banking', label: 'Banking', requires: 'banking.manage' },
      { to: '/projects', label: 'Projects' },
      { to: '/reports', label: 'Reports', requires: 'reports.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/customers', label: 'Customers' },
      { to: '/suppliers', label: 'Suppliers' },
      { to: '/team', label: 'Team', requires: 'users.manage' },
      { to: '/hr', label: 'HR & Payroll', requires: 'hr.manage' },
      { to: '/crm', label: 'CRM', requires: 'crm.manage' },
      { to: '/loyalty', label: 'Loyalty', requires: 'loyalty.manage' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/ai-insights', label: 'Insights', requires: 'reports.view' },
      { to: '/ecommerce', label: 'E-commerce', requires: 'ecommerce.manage' },
    ],
  },
  {
    label: 'Industry',
    // Gated by the company's ACTIVATED modules (Company.activeModules,
    // set by a platform admin at onboarding — see requireActiveModule.js
    // on the backend), not by user permission — every one of these was
    // previously shown to every user at every company regardless of which
    // industries that company actually operates in, meaning a Retail-only
    // tenant saw working-looking nav links to Jewelry, Hospital, School...
    // that would 404/403 the moment any of their real API calls ran.
    items: INDUSTRY_MODULES.map(({ key, path, label }) => ({ to: path, label, requiresModule: key })),
  },
];

export function Sidebar({ mobileOpen, onClose }) {
  const { company, logout, user, can } = useAuth();

  const visibleSections = SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requiresModule) return company?.activeModules?.includes(item.requiresModule);
        if (item.requires) return can(item.requires);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0); // an empty section header with nothing under it is worse than no header at all

  const content = (
    <>
      <div className="px-4 py-4 border-b border-rule flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-display text-lg leading-none text-ink">Muhasib</p>
          <p className="text-xs text-ink-muted mt-1 truncate">{company?.name || '—'}</p>
        </div>
        {/* Close button only rendered/visible in the mobile drawer — the static desktop sidebar has no need for it. */}
        <button onClick={onClose} className="md:hidden text-ink-muted hover:text-ink text-xl leading-none px-1" aria-label="Close menu">
          ×
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {visibleSections.map((section) => {
          const SectionIcon = SECTION_ICONS[section.label] || Circle;
          return (
            <div key={section.label} className="mb-4">
              <p className="px-4 mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted/70">
                <SectionIcon size={12} strokeWidth={2.5} />
                {section.label}
              </p>
              {section.items.map((item) => {
                const ItemIcon = ITEM_ICONS[item.to] || Circle;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-4 py-1.5 text-sm mx-2 rounded ${
                        isActive ? 'bg-accent-soft text-accent-strong font-medium' : 'text-ink hover:bg-paper'
                      }`
                    }
                  >
                    <ItemIcon size={15} strokeWidth={2} className="shrink-0 opacity-70" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-rule px-4 py-3">
        <p className="text-sm text-ink truncate">{user?.name}</p>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-danger mt-0.5">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Static sidebar — desktop/tablet only. Always in the layout flow, never overlays content. */}
      <aside className="hidden md:flex w-56 shrink-0 h-screen sticky top-0 bg-surface border-r border-rule flex-col">
        {content}
      </aside>

      {/* Mobile drawer — an overlay + slide-in panel, only mounted below the md breakpoint.
          Backdrop click and the × button both close it; navigating also closes it (onClose above). */}
      <div className={`md:hidden fixed inset-0 z-40 ${mobileOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-ink/30 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={`absolute inset-y-0 left-0 w-64 bg-surface border-r border-rule flex flex-col transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {content}
        </aside>
      </div>
    </>
  );
}
