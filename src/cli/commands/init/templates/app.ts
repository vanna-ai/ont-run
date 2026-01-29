// ============================================================================
// App Templates
// ============================================================================

export const frontendTemplate = `import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
`;

export const appTemplate = `import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./routes/home";
import { Dashboard } from "./routes/dashboard";
import { About } from "./routes/about";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}
`;
