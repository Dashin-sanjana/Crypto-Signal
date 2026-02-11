import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import Header from '../components/Header/Header';
import { Card } from '../components/ui/card';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  return (
    <div className={styles.shell}>
      <div className={`${styles.bgGlow} ${styles.bgGlowTopLeft}`} />
      <div className={`${styles.bgGlow} ${styles.bgGlowBottomRight}`} />

      <Header />

      <main className={styles.layout}>
        <aside className={styles.sidebar}>
          <Card className={styles.navCard}>
            <div className={styles.navTitle}>Navigation</div>
            <nav className={styles.navList} aria-label="Main navigation">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navItemIcon}>📊</span>
                <span className={styles.navItemLabel}>Dashboard</span>
              </NavLink>

              <NavLink
                to="/bot"
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navItemIcon}>🤖</span>
                <span className={styles.navItemLabel}>Bot Control</span>
              </NavLink>

              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navItemIcon}>⚙️</span>
                <span className={styles.navItemLabel}>Settings</span>
              </NavLink>
            </nav>
          </Card>
        </aside>

        <section className={styles.content}>{children}</section>
      </main>
    </div>
  );
};

export default AppShell;

