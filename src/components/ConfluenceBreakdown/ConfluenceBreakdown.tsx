import React from 'react';
import styles from './ConfluenceBreakdown.module.css';

interface ConfluenceBreakdownProps {
  confluence: Record<string, boolean>;
}

const ConfluenceBreakdown: React.FC<ConfluenceBreakdownProps> = ({ confluence }) => {
  const methods = [
    { name: 'Elliott Wave', key: 'elliottWave' },
    { name: 'Patterns', key: 'patterns' },
    { name: 'S/R', key: 'supportResistance' },
    { name: 'Volume', key: 'volume' },
    { name: 'Structure', key: 'marketStructure' },
    { name: 'Momentum', key: 'momentum' }
  ];

  return (
    <div className={styles.confluence}>
      <div className={styles.title}>Confluence</div>
      <div className={styles.methods}>
        {methods.map(({ name, key }) => (
          <div
            key={key}
            className={`${styles.method} ${confluence[key] ? styles.active : ''}`}
            title={name}
          >
            <span className={styles.icon}>
              {confluence[key] ? '✓' : '✕'}
            </span>
            <span className={styles.name}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfluenceBreakdown;
