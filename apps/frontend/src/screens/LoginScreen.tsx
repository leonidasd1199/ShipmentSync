import { useState, useEffect } from "react";
import loginImg from "/images/second-img-login.webp";
import { useAuthStore } from "../stores/auth.store";
import { useNavigate } from "react-router-dom";
import { login } from "../services/auth.service";

function LoginScreen() {
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (token && user) {
      navigate("/", { replace: true });
    }
  }, [token, user, navigate]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({
      ...p,
      [e.target.type === "email" ? "email" : "password"]: e.target.value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.email || !form.password) {
      setErrorMsg("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      const res = await login({
        email: form.email.trim(),
        password: form.password,
      });

      setSession(res.access_token, res.user ?? null);
      navigate("/", { replace: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Invalid credentials or server error.";
      setErrorMsg(
        Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex w-1/2">
        <img src={loginImg} alt="Design" className="object-cover w-full h-full" />
      </div>

      <div className="flex w-full md:w-1/2 items-center justify-center bg-neutral-900 text-white px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-2">
              Welcome Back
            </h2>
            <h1 className="text-3xl font-bold">Sign in to your account</h1>
            <p className="text-gray-400 text-sm mt-2">
              Enter your credentials to access the dashboard.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={onSubmit}>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={onChange}
                className="w-full px-4 py-3 rounded-md bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={onChange}
                className="w-full px-4 py-3 rounded-md bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                disabled={loading}
              />
            </div>

            {errorMsg && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded p-2">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-6 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-md transition-colors"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
