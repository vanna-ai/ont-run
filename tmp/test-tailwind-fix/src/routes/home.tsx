import { useState, useEffect } from "react";

interface HealthStatus {
  status: string;
  name: string;
  env: string;
}

export function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/health")
      .then(res => res.json())
      .then(setHealth)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
        <p className="mt-2 text-gray-600">
          Your full-stack Bun + React app is running.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Health</h2>
        {health ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gray-500">Status:</span>{" "}
              <span className="text-green-600 font-medium">{health.status}</span>
            </p>
            <p>
              <span className="text-gray-500">API Name:</span>{" "}
              <span className="font-medium">{health.name}</span>
            </p>
            <p>
              <span className="text-gray-500">Environment:</span>{" "}
              <span className="font-medium">{health.env}</span>
            </p>
          </div>
        ) : (
          <p className="text-gray-500">Loading...</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/api" className="text-blue-600 hover:underline">
              /api
            </a>
            <span className="text-gray-500"> - API introspection</span>
          </li>
          <li>
            <a href="/health" className="text-blue-600 hover:underline">
              /health
            </a>
            <span className="text-gray-500"> - Health check endpoint</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
