import { Routes, Route, Navigate } from "react-router-dom";
import DashboardScreen from "../screens/DashboardScreen";
import { useAuthStore } from "../stores/auth.store";
import { PermissionGate } from "../components/PermissionGate";
import { PERMISSIONS } from "../utils/permissions";
import OfficeScreen from "../screens/OfficeScreen";
import OfficeUsersScreen from "../screens/OfficeUsersScreen";
import ClientScreen from "../screens/ClientScreen";
import UserPermissions from "../screens/UserPermissionsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ShippingLinesScreen from "../screens/ShippingLinesScreen";
import AgentsScreen from "../screens/AgentsScreen";
import QuotationsScreen from "../screens/QuotationsScreen";
import CreateEditQuotationPage from "../screens/CreateEditQuotationPage";
import TemplatesScreen from "../screens/TemplateScreen";
import CreateEditTemplatePage from "../screens/CreateEditTemplatePage";
import ShipmentsScreen from "../screens/ShipmentsScreen";
import CreateEditShipmentPage from "../screens/CreateEditShipmentPage";
import AgentsManagementPage from "../screens/AgentManagementPage";
import OperatorPricingScreen from "../screens/OperatorPricingScreen";
import CreateQuoteScreen from "../screens/CreateQuoteScreen";
import QuotationsSentScreen from "../screens/QuotationsSentScreen";
import FinanceScreen from "../screens/FinanceScreen";
import { RoleGate } from "../components/RoleGate";
import ClientQuotationsScreen from "../screens/Clients/ClientQuotationsScreen";
import ClientShipmentsScreen from "../screens/Clients/ClientShipmentsScreen";

export default function OperativeRoutes() {
  const { user } = useAuthStore();
  const userPermissions = user?.permissions || [];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Routes>
        <Route path="/" element={<DashboardScreen />} />

        <Route
          path="/offices"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.OFFICE_LIST}
              userPermissions={userPermissions}
            >
              <OfficeScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/offices/:id/users"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.USER_READ}
              userPermissions={userPermissions}
            >
              <OfficeUsersScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/clients"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.CLIENT_LIST}
              userPermissions={userPermissions}
            >
              <ClientScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/agents"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.AGENT_LIST}
              userPermissions={userPermissions}
            >
              <AgentsManagementPage />
            </PermissionGate>
          }
        />

        <Route
          path="/users/permissions"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.PERMISSIONS_ASSIGN}
              userPermissions={userPermissions}
            >
              <UserPermissions />
            </PermissionGate>
          }
        />

        <Route
          path="/me"
          element={
            <ProfileScreen />
          }
        />

        <Route
          path="/suppliers"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPPING_LIST}
              userPermissions={userPermissions}
            >
              <ShippingLinesScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/suppliers/:supplierId/agents"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.AGENT_LIST}
              userPermissions={userPermissions}
            >
              <AgentsScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/estimates"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.QUOTATION_LIST}
              userPermissions={userPermissions}
            >
              <QuotationsScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/estimates/new"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.QUOTATION_CREATE}
              userPermissions={userPermissions}
            >
              <CreateEditQuotationPage />
            </PermissionGate>
          }
        />

        <Route
          path="/estimates/:id/edit"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.QUOTATION_UPDATE}
              userPermissions={userPermissions}
            >
              <CreateEditQuotationPage />
            </PermissionGate>
          }
        />

        <Route
          path="/templates"
          element={
            <PermissionGate
              userPermissions={userPermissions}
            >
              <TemplatesScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/templates/new"
          element={
            <PermissionGate
              userPermissions={userPermissions}
            >
              <CreateEditTemplatePage />
            </PermissionGate>
          }
        />

        <Route
          path="/templates/:id/edit"
          element={
            <PermissionGate
              userPermissions={userPermissions}
            >
              <CreateEditTemplatePage />
            </PermissionGate>
          }
        />

        <Route
          path="/shipments"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPMENT_LIST}
              userPermissions={userPermissions}
              redirect
            >
              <ShipmentsScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/shipments/new"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPMENT_CREATE}
              userPermissions={userPermissions}
              redirect
            >
              <CreateEditShipmentPage />
            </PermissionGate>
          }
        />

        <Route
          path="/shipments/:id/edit"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPMENT_UPDATE}
              userPermissions={userPermissions}
              redirect
            >
              <CreateEditShipmentPage />
            </PermissionGate>
          }
        />

        <Route
          path="/quotes/new"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.QUOTATION_CREATE}
              userPermissions={userPermissions}
            >
              <CreateQuoteScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/pricing/suppliers"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPPING_READ}
              userPermissions={userPermissions}
            >
              <OperatorPricingScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/pricing/suppliers/:supplierId"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPPING_READ}
              userPermissions={userPermissions}
            >
              <OperatorPricingScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/finance"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SUPPLIER_DEBITS_READ}
              userPermissions={userPermissions}
              redirect
            >
              <FinanceScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/supplier-debits"
          element={
            <Navigate to="/finance?tab=debits" replace />
          }
        />

        <Route
          path="/pricing/quotations-sent"
          element={
            <PermissionGate
              requiredPermission={PERMISSIONS.SHIPPING_READ}
              userPermissions={userPermissions}
            >
              <QuotationsSentScreen />
            </PermissionGate>
          }
        />

        <Route
          path="/quotations"
          element={
            <RoleGate
              requiredRole="client"
              userRole={user?.roleCode}
              redirect
            >
              <ClientQuotationsScreen />
            </RoleGate>
          }
        />
         <Route
          path="/client-shipments"
          element={
            <RoleGate
              requiredRole="client"
              userRole={user?.roleCode}
              redirect
            >
              <ClientShipmentsScreen />
            </RoleGate>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
