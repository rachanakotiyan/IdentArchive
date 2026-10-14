import { useState } from 'react';
import './Tabs.css';

/**
 * Tabs
 * @param {Array<{id, label, panel}>} tabs
 * @param {string} defaultTab - id of default active tab
 */
export default function Tabs({ tabs = [], defaultTab, className = '' }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const currentTab = tabs.find(t => t.id === active);

  return (
    <div className={`tabs ${className}`}>
      <div className="tabs__list" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`tabpanel-${t.id}`}
            className="tabs__tab"
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="tabs__panel"
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {currentTab?.panel}
      </div>
    </div>
  );
}
