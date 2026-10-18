import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Logo.css';

/**
 * Logo
 * Monogram badge + optional wordmark.
 * Uses currentColor / tokens - works in both themes.
 *
 * @param {number}  size         - badge size in px (default 32)
 * @param {boolean} showWordmark - whether to show "IdentArchive" text
 * @param {string}  to           - link destination (default '/')
 * @param {string}  as           - 'a' for anchor, 'span' for non-link
 */
export default function Logo({ size = 44, showWordmark = true, to = '/', as: Tag, className = '' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const fontSize = Math.round(size * 0.45);
  const radius   = Math.round(size * 0.22);

  const badge = (
    <>
      {imageFailed ? (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="logo__badge"
          style={{ borderRadius: radius }}
        >
          <rect width="32" height="32" rx={radius} fill="var(--accent-subtle)" />
          <rect x="1" y="1" width="30" height="30" rx={radius - 1} stroke="var(--accent)" strokeWidth="1.5" fill="none" />
          <path d="M8 11 Q8 9 10 9 L16 9 Q17.5 9 18 11 L24 11 Q24 11 24 13 L8 13 Z" fill="var(--accent)" opacity="0.35" />
          <text
            x="16"
            y="23"
            textAnchor="middle"
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight="700"
            fontSize={fontSize}
            fill="var(--accent)"
          >
            IA
          </text>
        </svg>
      ) : (
        <img
          src="/identarchive-logo.png"
          alt=""
          aria-hidden="true"
          className="logo__badge logo__badge--image"
          width={size}
          height={size}
          onError={() => setImageFailed(true)}
        />
      )}
      {showWordmark && (
        <span className="logo__wordmark">
          Ident<span>Archive</span>
        </span>
      )}
    </>
  );

  const classes = ['logo', className].filter(Boolean).join(' ');

  if (Tag === 'span') {
    return <span className={classes}>{badge}</span>;
  }

  return (
    <Link to={to} className={classes} aria-label="IdentArchive - home">
      {badge}
    </Link>
  );
}
