// ============================================================================
// Login Screen Component
// ============================================================================

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogIn, AlertCircle, User, Lock } from "lucide-react";

const DEMO_CREDENTIALS = [
  { email: "admin@example.com", password: "admin123", label: "Admin", groups: "admin, support, public" },
  { email: "support@example.com", password: "support123", label: "Support", groups: "support, public" },
  { email: "user@example.com", password: "user123", label: "Public", groups: "public" },
];

export function LoginScreen() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    await login(demoEmail, demoPassword);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Sign In</h3>
        <p className="text-sm text-gray-500">to access the chat</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <LogIn className="h-4 w-4" />
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="border-t pt-4 mt-4">
        <p className="text-xs text-gray-500 mb-3 text-center">Demo Accounts</p>
        <div className="space-y-2">
          {DEMO_CREDENTIALS.map((demo) => (
            <button
              key={demo.email}
              onClick={() => handleDemoLogin(demo.email, demo.password)}
              disabled={isLoading}
              className="w-full text-left p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-800">{demo.label}</span>
                <span className="text-xs text-gray-400">{demo.email}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Groups: {demo.groups}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
