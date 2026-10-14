import './Skeleton.css';

/**
 * Skeleton loader
 * @param {string|number} width  - CSS width (default '100%')
 * @param {string|number} height - CSS height
 * @param {'text'|'rect'|'circle'} shape
 * @param {'sm'|'md'|'lg'|'xl'} size - predefined height if height not set
 */
export default function Skeleton({
  width = '100%',
  height,
  shape = 'rect',
  size,
  className = '',
  style = {},
}) {
  const classes = [
    'skeleton',
    `skeleton--${shape}`,
    size ? `skeleton--${size}` : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      style={{
        width,
        ...(height ? { height } : {}),
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
