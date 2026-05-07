import React from "react";
import { createRoot } from "react-dom/client";
import { MapPage } from "../pages/MapPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MapPage />
  </React.StrictMode>,
);

