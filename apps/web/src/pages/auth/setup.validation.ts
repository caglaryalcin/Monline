import type { FieldErrors } from "react-hook-form";

import { SETUP_FIELDS, type SetupForm } from "./setup.schema";

/** Global errors leave the current step intact; field errors reveal their first step. */
export function revealInvalidSetupStep(
  errors: FieldErrors<SetupForm>,
  select: (step: number) => void,
) {
  const index = SETUP_FIELDS.findIndex((fields) => fields.some((field) => errors[field]));
  if (index >= 0) select(index);
}
