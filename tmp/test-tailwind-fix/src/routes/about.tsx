export function About() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">About</h1>
        <p className="mt-2 text-gray-600">
          This is an example route to demonstrate React Router.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stack</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li><strong>Runtime:</strong> Bun</li>
          <li><strong>Frontend:</strong> React 19 + React Router 7</li>
          <li><strong>Styling:</strong> TailwindCSS 4</li>
          <li><strong>API:</strong> Ontology (ont-run)</li>
        </ul>
      </div>
    </div>
  );
}
