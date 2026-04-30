import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle, LinkIcon, RefreshCw } from "lucide-react";
import { useAgentAuthStore } from "../../stores/agent-auth.store";
import { AgentAuthService } from "../../services/agent-auth.api";

type MagicLinkStatus = "validating" | "success" | "error";

interface ErrorState {
  title: string;
  message: string;
  canRetry: boolean;
}

export default function MagicLinkCallbackScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useAgentAuthStore();

  const [status, setStatus] = useState<MagicLinkStatus>("validating");
  const [error, setError] = useState<ErrorState | null>(null);

  const token = searchParams.get("token");

  const getErrorDetails = (errorMessage: string, statusCode?: number): ErrorState => {
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes("expired")) {
      return {
        title: "Link Expired",
        message:
          "This magic link has expired. Please request a new access link from your administrator.",
        canRetry: false,
      };
    }

    if (lowerMessage.includes("already been used")) {
      return {
        title: "Link Already Used",
        message:
          "This magic link has already been used. Magic links can only be used once for security reasons.",
        canRetry: false,
      };
    }

    if (lowerMessage.includes("invalid") || statusCode === 401) {
      return {
        title: "Invalid Link",
        message:
          "This magic link is invalid or has been revoked. Please request a new access link.",
        canRetry: false,
      };
    }

    if (lowerMessage.includes("inactive")) {
      return {
        title: "Account Inactive",
        message:
          "Your agent account is currently inactive. Please contact your administrator for assistance.",
        canRetry: false,
      };
    }

    if (statusCode === 404) {
      return {
        title: "Agent Not Found",
        message:
          "The agent associated with this link could not be found. Please contact support.",
        canRetry: false,
      };
    }

    // Network or server errors
    if (statusCode && statusCode >= 500) {
      return {
        title: "Server Error",
        message:
          "We're experiencing technical difficulties. Please try again in a few moments.",
        canRetry: true,
      };
    }

    // Default error
    return {
      title: "Authentication Failed",
      message:
        "Something went wrong while validating your access link. Please try again or request a new link.",
      canRetry: true,
    };
  };

  const validateToken = async () => {
    if (!token) {
      setError({
        title: "Missing Token",
        message: "No access token was provided. Please use the complete link from your email.",
        canRetry: false,
      });
      setStatus("error");
      return;
    }

    setStatus("validating");
    setError(null);

    try {
      const response = await AgentAuthService.validateMagicLink(token);

      // Store session
      setSession(response.access_token, {
        id: response.agent.id,
        firstName: response.agent.firstName,
        lastName: response.agent.lastName,
        email: response.agent.email,
      });

      setStatus("success");

      // Redirect to agent dashboard
      setTimeout(() => {
        navigate("/agent", { replace: true });
      }, 1000);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: {
          status?: number;
          data?: { message?: string };
        };
        message?: string;
      };

      const statusCode = axiosError.response?.status;
      const message =
        axiosError.response?.data?.message ||
        axiosError.message ||
        "An unexpected error occurred";

      setError(getErrorDetails(message, statusCode));
      setStatus("error");
    }
  };

  useEffect(() => {
    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Validating State */}
        {status === "validating" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mx-auto mb-6">
              <Loader2 size={32} className="text-neutral-600 animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-neutral-900 mb-2">
              Validating your access link
            </h1>
            <p className="text-neutral-500">
              Please wait while we verify your credentials...
            </p>
          </div>
        )}

        {/* Success State */}
        {status === "success" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-6">
              <LinkIcon size={32} className="text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-neutral-900 mb-2">
              Access Granted
            </h1>
            <p className="text-neutral-500">
              Redirecting you to the dashboard...
            </p>
            <div className="mt-4">
              <div className="h-1 w-32 bg-neutral-200 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === "error" && error && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-6">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 mb-2">
                {error.title}
              </h1>
              <p className="text-neutral-500 mb-6">{error.message}</p>

              <div className="space-y-3">
                {error.canRetry && (
                  <button
                    onClick={validateToken}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
                  >
                    <RefreshCw size={18} />
                    Try Again
                  </button>
                )}

                <div className="pt-4 border-t border-neutral-200">
                  <p className="text-sm text-neutral-500">
                    Need help?{" "}
                    <a
                      href="mailto:support@shipsync.com"
                      className="text-neutral-900 font-medium hover:underline"
                    >
                      Contact Support
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-neutral-400 mt-6">
          ShipSync Portal • Secure Agent Access
        </p>
      </div>
    </div>
  );
}