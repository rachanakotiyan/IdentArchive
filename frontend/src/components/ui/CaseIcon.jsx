import { getCaseIcon } from '../../utils/caseIcons.js';

/**
 * CaseIcon
 * Renders the Lucide icon for a given crimeType.
 * @param {string}  crimeType
 * @param {'sm'|'md'|'lg'} size  - sm=16, md=24, lg=40
 * @param {string}  className
 * @param {string}  color     - CSS color (defaults to currentColor)
 */
const SIZE_MAP = { sm: 16, md: 24, lg: 40 };

export default function CaseIcon({ crimeType, size = 'md', className = '', color }) {
  const Icon = getCaseIcon(crimeType);
  const px   = SIZE_MAP[size] ?? SIZE_MAP.md;

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
