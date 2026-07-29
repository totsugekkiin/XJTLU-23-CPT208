import React from "react";
import { RouteSection } from "../components/RouteSection.jsx";
import {
  createVariantHref,
  resolveExperienceVariant,
} from "../../js/appmain/experienceVariant.js";

export function MapPage() {
  const experienceVariant = resolveExperienceVariant();
  const returnHref = createVariantHref("appMain.html", experienceVariant);

  return <RouteSection standalone showBackButton returnHref={returnHref} />;
}

