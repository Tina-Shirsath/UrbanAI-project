import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminHeatmap from "./pages/AdminHeatmap";
import Report from "./pages/Report";
import TrackIncident from "./pages/TrackIncident";
import AdminAuthProvider from "./context/AdminAuthProvider";

function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<Report />} />
          <Route path="/track" element={<TrackIncident />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/heatmap" element={<AdminHeatmap />} />
          <Route
            path="/dashboard"
            element={(
              <Navigate
                to="/admin/login"
                replace
                state={{ notice: "Incident records are available to authorized government administrators." }}
              />
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;
