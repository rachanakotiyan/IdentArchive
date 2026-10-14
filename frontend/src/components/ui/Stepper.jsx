import { Check } from 'lucide-react';
import './Stepper.css';

/**
 * Stepper
 * @param {Array<{id, label}>} steps
 * @param {number} currentStep - 0-indexed
 */
export default function Stepper({ steps = [], currentStep = 0 }) {
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((step, i) => {
        const isDone   = i < currentStep;
        const isActive = i === currentStep;
        const modClass = isDone ? 'stepper__step--done' : isActive ? 'stepper__step--active' : '';

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div className={`stepper__step ${modClass}`}>
              <div
                className="stepper__circle"
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${step.label}${isDone ? ' (complete)' : ''}`}
              >
                {isDone ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </div>
              <span className="stepper__label">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`stepper__connector${isDone ? ' stepper__connector--done' : ''}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
