import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginScreen from "./screens/LoginScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import PrivateSection from "./components/PrivateSection";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import OperativeRoutes from "./sections/OperativeRoutes";
import AgentRoutes from "./sections/AgentRoutes";
import AgentUnauthorizedScreen from "./screens/Agents/AgentuUnauthorizedScreen";
import MagicLinkCallbackScreen from "./screens/Agents/MagicLinkCallBackScreen";
import ChangePasswordModal from "./components/modals/Users/ChangePasswordModal";
import { changePassword, getMyProfile } from "./services/auth.service";
import "./App.css";
import { useAuthStore } from "./stores/auth.store";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => (s).setUser ?? (() => {}));

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      // Skip profile loading for agent routes and auth routes
      if (location.pathname.startsWith("/agent") || location.pathname.startsWith("/auth")) {
        return;
      }

      try {
        const data = await getMyProfile();
        const user = data?.user ?? null;
        setUser(user);

        if (user?.mustChangePassword) {
          setShowChangePassword(true);
          if (location.pathname !== "/") {
            navigate("/", { replace: true });
          }
        }
      } catch {
        logout();
        navigate("/login", { replace: true });
      }
    };

    if (isMounted) void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifyOnRouteChange = async () => {
      // Skip verification for agent routes and auth routes
      if (location.pathname.startsWith("/agent") || location.pathname.startsWith("/auth")) {
        return;
      }

      try {
        const data = await getMyProfile();
        const user = data?.user ?? null;
        setUser(user);

        if (!cancelled && user?.mustChangePassword) {
          setShowChangePassword(true);
          if (location.pathname !== "/") {
            navigate("/", { replace: true });
          }
        }
      } catch {
        logout();
        navigate("/login", { replace: true });
      }
    };

    void verifyOnRouteChange();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate, setUser, logout]);

  const handleChangePassword = async (payload: { currentPassword: string; newPassword: string }) => {
    await changePassword({
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });

    setShowChangePassword(false);

    try {
      const data = await getMyProfile();
      const user = data?.user ?? null;
      setUser(user);
    } catch {
      logout();
      navigate("/login", { replace: true });
    }

    navigate("/");
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        
        {/* Magic Link Authentication - Public */}
        <Route path="/auth/magic-link" element={<MagicLinkCallbackScreen />} />
        
        {/* Agent Unauthorized - Public (must be BEFORE /agent/*) */}
        <Route path="/agent/unauthorized" element={<AgentUnauthorizedScreen />} />
        
        {/* Agent Portal Routes - Protected */}
        <Route path="/agent/*" element={<AgentRoutes />} />
        
        {/* Main App Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <PrivateSection
                header={<AppHeader title="ShipSync" />}
                sidebar={<AppSidebar initialExpanded />}
                routes={<OperativeRoutes />}
              />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ChangePasswordModal
        open={showChangePassword}
        forceChange
        onClose={() => setShowChangePassword(false)}
        onChangePassword={handleChangePassword}
      />
    </>
  );
}

export default App;