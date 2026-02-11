import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import styles from './SettingsPage.module.css';

const SettingsPage = () => {
  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <Card>
          <div className={styles.sectionTitle}>Connections</div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Exchange API Key
              <input
                className={styles.input}
                type="password"
                placeholder="Enter API key"
              />
            </label>
            <label className={styles.label}>
              Exchange Secret
              <input
                className={styles.input}
                type="password"
                placeholder="Enter API secret"
              />
            </label>
            <Button size="sm">Save Connection</Button>
          </div>
        </Card>

        <Card>
          <div className={styles.sectionTitle}>Risk Defaults</div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Max concurrent positions
              <input
                className={styles.input}
                type="number"
                min={1}
                placeholder="e.g. 5"
              />
            </label>
            <label className={styles.label}>
              Max risk per trade (%)
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.1}
                placeholder="e.g. 1.0"
              />
            </label>
            <Button size="sm" variant="outline">
              Save Risk Profile
            </Button>
          </div>
        </Card>

        <Card>
          <div className={styles.sectionTitle}>Notifications</div>
          <div className={styles.fieldGroup}>
            <div className={styles.switchRow}>
              <span className={styles.label}>Desktop notifications</span>
              <input type="checkbox" />
            </div>
            <div className={styles.switchRow}>
              <span className={styles.label}>Telegram alerts</span>
              <input type="checkbox" />
            </div>
            <Button size="sm" variant="ghost">
              Save Notification Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;

