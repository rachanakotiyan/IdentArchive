import {
  AlertTriangle,
  File,
  HelpCircle,
  Navigation,
  ShieldAlert,
  Truck,
  UserX,
  Users,
} from 'lucide-react';

const SIZE_MAP = { sm: 16, md: 24, lg: 40 };
const CASE_ICON_MAP = {
  missing_person: UserX,
  unidentified_person: HelpCircle,
  abduction: ShieldAlert,
  runaway: Navigation,
  trafficking: Truck,
  domestic_violence: AlertTriangle,
  group_missing: Users,
  other: File,
};

export default function CaseIcon({ crimeType, size = 'md', className = '', color }) {
  const Icon = CASE_ICON_MAP[crimeType] ?? File;
  const px = SIZE_MAP[size] ?? SIZE_MAP.md;

  return (
    <Icon
      size={px}
      className={className}
      color={color ?? 'currentColor'}
      aria-hidden="true"
      strokeWidth={1.5}
    />
  );
}
