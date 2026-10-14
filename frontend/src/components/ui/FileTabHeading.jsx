import './FileTabHeading.css';

/**
 * FileTabHeading
 * Section title with a file-tab style (dossier motif).
 * @param {boolean} active - shows as the active (front) tab
 * @param {React.ReactNode} icon - optional lucide icon
 * @param {string} as - element tag
 */
export default function FileTabHeading({
  children,
  active = true,
  icon,
  as: Tag = 'h2',
  className = '',
  ...rest
}) {
  const classes = [
    'file-tab-heading',
    active ? 'file-tab-heading--active' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...rest}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </Tag>
  );
}
