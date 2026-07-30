import React from "react";
import { AR_FIELD_MAP_HEIGHT, AR_FIELD_MAP_WIDTH } from "../../js/ar/arFieldMapConfig.js";

export const AR_FIELD_MAP_VIEWBOX = `0 0 ${AR_FIELD_MAP_WIDTH} ${AR_FIELD_MAP_HEIGHT}`;

export function ArFieldMapPlan() {
  return (
    <>
      <path className="ar-field-map-plan__route" d="M32 75 161 192h228l30-24h151" />
      <g className="ar-field-map-plan__wall" aria-hidden="true">
        <path d="M4 16 151 150h238l18-15" />
        <path d="M4 92 151 217h262v-81h170v54h-25v14h-38v13H413" />
        <path d="M24 53 163 177h226l18-16" className="ar-field-map-plan__wall-detail" />
        <path d="M41 69 66 47M48 75l25-22M55 81l25-22M62 87l25-22M69 93l25-22M76 99l25-22M83 105l25-22" />
        <path d="M398 138v19M402 138v19M406 138v19M410 138v19M414 138v19" />
        <path d="M426 149h94v55h-94zM426 149l94 55M520 149l-94 55" />
        <path d="M528 138v14M533 138v14M538 138v14M543 138v14M548 138v14M553 138v14M558 138v14" />
        <path d="M572 151h11M572 158h11M572 165h11M572 172h11M572 179h11M572 186h11" />
        <path d="M389 136v81M413 136v81M520 136v81" className="ar-field-map-plan__wall-detail" />
      </g>
    </>
  );
}
