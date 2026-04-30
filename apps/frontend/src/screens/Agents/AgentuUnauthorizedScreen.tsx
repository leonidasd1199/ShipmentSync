import { ShieldX, Mail } from "lucide-react";

export default function AgentUnauthorizedScreen() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto mb-6">
              <ShieldX size={32} className="text-amber-600" />
            </div>
            <h1 className="text-xl font-semibold text-neutral-900 mb-2">
              Access Required
            </h1>
            <p className="text-neutral-500 mb-6">
              You need a valid magic link to access the agent portal. Please check your email for an access link or contact your administrator.
            </p>

            <div className="bg-neutral-50 rounded-lg p-4 text-left">
              <div className="flex items-start gap-3">
                <Mail size={20} className="text-neutral-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    Check your email
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Look for an email from ShipSync Portal with your personalized access link.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-200 mt-6">
              <p className="text-sm text-neutral-500">
                Need a new access link?{" "}
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

        <p className="text-center text-sm text-neutral-400 mt-6">
          ShipSync Portal •
        </p>
      </div>
    </div>
  );
}