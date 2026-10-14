import './Card.css';

/**
 * Card
 * @param {boolean} interactive - adds hover/focus styles
 * @param {boolean} flush       - removes padding
 * @param {boolean} raised      - adds a subtle shadow
 * @param {string}  as          - element tag (default 'div')
 */
export default function Card({
  children,
  interactive = false,
  flush = false,
  raised = false,
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const classes = [
    'card',
    interactive ? 'card--interactive' : '',
    flush ? 'card--flush' : '',
    raised ? 'card--raised' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
