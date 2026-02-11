import TradingDashboard from '../components/Trading/TradingDashboard';
import styles from './BotControlPage.module.css';

const BotControlPage = () => {
  return (
    <div className={styles.page}>
      {/* TradingDashboard already includes signal overview, conditions, positions and activity */}
      <TradingDashboard />
    </div>
  );
};

export default BotControlPage;

