import React from "react";
import { createRoot } from "react-dom/client";
import { exposeGlobals } from "../shared/exposeGlobals.js";
import { HomePage } from "../pages/HomePage.jsx";

exposeGlobals();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HomePage />
  </React.StrictMode>,
);

