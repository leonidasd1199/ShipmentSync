import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  Loader2,
  Package,
} from "lucide-react";
import { useAgentAuthStore } from "../../stores/agent-auth.store";

// =============================================================================
// TYPES
// =============================================================================

type DashboardItem = {
  to: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

type SupplierInfo = {
  _id: string;
  name: string;
  email: string;
  shippingModes: string[];
};

type DashboardStats = {
  activePrices: number;
  totalValue: number;
  lastUpdated: Date | null;
};

// =============================================================================
// MOCK DATA - Replace with API calls when backend is ready
// =============================================================================

const MOCK_SUPPLIER: SupplierInfo = {
  _id: "supplier-001",
  name: "MSC Mediterranean Shipping",
  email: "rates@msc.com",
  shippingModes: ["maritime"],
};

const MOCK_STATS: DashboardStats = {
  activePrices: 3,
  totalValue: 6550,
  lastUpdated: new Date("2025-01-15"),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AgentDashboardScreen() {
  const navigate = useNavigate();
  const { agent } = useAgentAuthStore();

  // State
  const [, setSupplier] = useState<SupplierInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activePrices: 0,
    totalValue: 0,
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);

  const displayName = agent?.firstName?.trim() || "Agent";

  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API calls when backend is ready
        // const supplierData = await ShippingsService.findOne(agent.shippingLineId);
        // const pricelistData = await PricelistService.getBySupplier(agent.shippingLineId);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        setSupplier(MOCK_SUPPLIER);
        setStats(MOCK_STATS);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [agent?.shippingLineId]);

  const items: DashboardItem[] = [
    {
      to: "/agent/price-maintenance",
      label: "Price Maintenance",
      description: "View and update your pricing information",
      Icon: DollarSign,
    },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="bg-neutral-50 min-h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 min-h-[calc(100vh-120px)]">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-2">
            Welcome, {displayName}!
          </h1>
          <p className="text-neutral-600">
            Manage your pricing and view your assigned information.
          </p>
        </div>


        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">


          <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                <Package size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Last Updated</p>
                <p className="text-base font-semibold text-neutral-900">
                  {stats.lastUpdated
                    ? stats.lastUpdated.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-4">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(({ to, label, description, Icon }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group w-full text-left bg-white rounded-xl border border-neutral-200 p-5 hover:border-neutral-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-100 group-hover:bg-neutral-900 transition-colors">
                    <Icon
                      size={24}
                      className="text-neutral-700 group-hover:text-white transition-colors"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 mb-1">
                      {label}
                    </h3>
                    <p className="text-sm text-neutral-500">{description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Getting Started Section - Only show if no prices yet */}
        {stats.activePrices === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-200 mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-neutral-500" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900 mb-2">
              Get Started with Price Maintenance
            </h3>
            <p className="text-sm text-neutral-500 mb-4 max-w-md mx-auto">
              You haven't added any prices yet. Start by adding your first price
              item to begin managing your rates.
            </p>
            <button
              onClick={() => navigate("/agent/price-maintenance")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              <DollarSign size={16} />
              Add Your First Price
            </button>
          </div>
        )}
      </div>
    </div>
  );
}