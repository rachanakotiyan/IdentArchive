/**
 * caseIcons.js
 * Maps crimeType to a lucide-react icon component.
 * All icons are line icons (Lucide). Used by <CaseIcon />.
 */

import {
  UserX,
  HelpCircle,
  AlertTriangle,
  Navigation,
  Truck,
  File,
  Users,
  ShieldAlert,
} from 'lucide-react';

export const CASE_ICON_MAP = {
  missing_person:     UserX,
  unidentified_person: HelpCircle,
  abduction:          ShieldAlert,
  runaway:            Navigation,
  trafficking:        Truck,
  domestic_violence:  AlertTriangle,
  group_missing:      Users,
  other:              File,
};

/** Fallback icon for unknown crimeType values */
export const FALLBACK_ICON = File;

/**
 * Returns the Lucide icon component for a given crimeType.
 * Falls back to FALLBACK_ICON for unknown values.
 * @param {string} crimeType
 * @returns {React.ComponentType}
 */
export function getCaseIcon(crimeType) {
  return CASE_ICON_MAP[crimeType] ?? FALLBACK_ICON;
}
