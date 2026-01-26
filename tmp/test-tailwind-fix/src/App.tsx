import { Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./routes/home";
import { About } from "./routes/about";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}
