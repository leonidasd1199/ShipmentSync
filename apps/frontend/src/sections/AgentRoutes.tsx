import { Routes, Route, Navigate } from "react-router-dom";
import AgentLayout from "../components/AgentLayout";
import AgentProtectedRoute from "../components/AgentProtectedRoute";
import AgentDashboardScreen from "../screens/Agents/AgentDashboardScreen";
import AgentPriceMaintenanceScreen from "../screens/Agents/AgentPriceMaintenanceScreen";
import AgentSupplierPriceDetailScreen from "../screens/Agents/AgentSupplierPriceDetailScreen";
import AgentUnauthorizedScreen from "../screens/Agents/AgentuUnauthorizedScreen";
import MagicLinkCallBackScreen from "../screens/Agents/MagicLinkCallBackScreen";

export default function AgentRoutes() {
  return (
    <Routes>
      {/* Magic link callback - NOT protected */}
      <Route path="auth" element={<MagicLinkCallBackScreen />} />
      
      {/* Unauthorized page - NOT protected */}
      <Route path="unauthorized" element={<AgentUnauthorizedScreen />} />

      {/* Protected routes */}
      <Route element={<AgentProtectedRoute><AgentLayout /></AgentProtectedRoute>}>
        <Route index element={<AgentDashboardScreen />} />
        <Route path="price-maintenance" element={<AgentPriceMaintenanceScreen />} />
        <Route path="prices/:supplierId" element={<AgentSupplierPriceDetailScreen />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Route>
    </Routes>
  );
}