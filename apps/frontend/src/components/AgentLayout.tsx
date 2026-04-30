import { Outlet } from "react-router-dom";
import { Ship, LogOut } from "lucide-react";
import { useAgentAuthStore } from "../stores/agent-auth.store";

export default function AgentLayout() {
  const { agent, logout } = useAgentAuthStore();

  const displayName = agent 
    ? `${agent.firstName} ${agent.lastName}`.trim() 
    : "Agent";

  const handleLogout = () => {
    logout();
    // Cuando magic link esté listo, redirigir a página de login o mensaje
    window.location.href = "/agent";
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900">
                <Ship size={18} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900">
                  Agent Portal
                </span>
                <span className="text-xs text-neutral-500">
                  ShipSync
                </span>
              </div>
            </div>

            {/* User info & actions */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-neutral-900">
                  {displayName}
                </span>
                {agent?.shippingLineName && (
                  <span className="text-xs text-neutral-500">
                    {agent.shippingLineName}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-neutral-500 text-center">
            © {new Date().getFullYear()} ShipSync. Agent Portal.
          </p>
        </div>
      </footer>
    </div>
  );
}