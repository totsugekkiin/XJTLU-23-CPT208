import React from "react";
import { createRoot } from "react-dom/client";
import PortfolioApp from "../portfolio/PortfolioApp.jsx";
import "../portfolio/portfolio.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortfolioApp />
  </React.StrictMode>,
);
