import { Navigate, useLocation } from "react-router-dom";
import { useAgentAuthStore } from "../stores/agent-auth.store";

interface AgentProtectedRouteProps {
  children: React.ReactNode;
}

export default function AgentProtectedRoute({ children }: AgentProtectedRouteProps) {
  const { token, agent } = useAgentAuthStore();
  const location = useLocation();

  // Check if user is authenticated as agent
  if (!token || !agent) {
    // Redirect to a generic unauthorized page or show error
    // We don't redirect to /agent/login because agents use magic links
    return (
      <Navigate
        to="/agent/unauthorized"
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
}