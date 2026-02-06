import React, { useState } from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import styles from './AutoTradingPanel.module.css';

const AutoTradingPanel: React.FC = () => {
    const {
        autoTradingEnabled,
        setAutoTradingEnabled,
        isConnected,
        riskStatus,
        openTrades,
        activateKillSwitch,
        minSignalStrength,
        setMinSignalStrength
    } = useTradingContext();

    const [showConfirm, setShowConfirm] = useState(false);

    const handleToggle = () => {
        if (!autoTradingEnabled) {
            setShowConfirm(true);
        } else {
            setAutoTradingEnabled(false);
        }
    };

    const confirmEnable = () => {
        setAutoTradingEnabled(true);
        setShowConfirm(false);
    };

    const handleKillSwitch = async () => {
        if (window.confirm('⚠️ KILL SWITCH: This will cancel all orders and disable auto-trading. Continue?')) {
            await activateKillSwitch();
        }
    };

    return (
        <div className={styles.autoTradingPanel}>
            <div className={styles.header}>
                <div className={styles.title}>
                    ⚡ Auto Trading
                    <span className={styles.testnetBadge}>TESTNET</span>
                </div>
                <span className={`${styles.statusBadge} ${isConnected ? styles.statusConnected : styles.statusDisconnected}`}>
                    {isConnected ? '● Connected' : '○ Disconnected'}
                </span>
            </div>

            {!isConnected && (
                <div className={styles.warningBanner}>
                    <span className={styles.warningIcon}>⚠️</span>
                    <span className={styles.warningText}>
                        Trading server not running. Start with: <code>npm run server</code>
                    </span>
                </div>
            )}

            {showConfirm && (
                <div className={styles.warningBanner}>
                    <span className={styles.warningIcon}>⚠️</span>
                    <div>
                        <span className={styles.warningText}>
                            Enable auto-trading? Trades will execute automatically based on signals.
                        </span>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <button
                                onClick={confirmEnable}
                                style={{
                                    padding: '6px 16px',
                                    background: '#00ff88',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: '#000',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Yes, Enable
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                style={{
                                    padding: '6px 16px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.mainToggle}>
                <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>Auto Execute Trades</span>
                    <span className={styles.toggleSubtitle}>
                        {autoTradingEnabled ? 'Trades will execute on strong signals' : 'Manual trading only'}
                    </span>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        checked={autoTradingEnabled}
                        onChange={handleToggle}
                        disabled={!isConnected || riskStatus?.killSwitchActive}
                    />
                    <span className={styles.slider}></span>
                </label>
            </div>

            {riskStatus && (
                <div className={styles.riskSection}>
                    <div className={styles.sectionTitle}>Risk Status</div>
                    <div className={styles.riskStats}>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Daily P&L</div>
                            <div className={`${styles.statValue} ${riskStatus.dailyPnL >= 0 ? styles.statValuePositive : styles.statValueNegative}`}>
                                ${riskStatus.dailyPnL.toFixed(2)}
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Loss Limit</div>
                            <div className={styles.statValue}>${riskStatus.dailyLossLimit}</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Open Trades</div>
                            <div className={styles.statValue}>{riskStatus.openTradesCount}/{riskStatus.maxOpenTrades}</div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Position Size</div>
                            <div className={styles.statValue}>${riskStatus.maxPositionSize}</div>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.settingsGrid}>
                <div className={styles.settingRow}>
                    <span className={styles.settingLabel}>Min Signal Strength</span>
                    <input
                        type="number"
                        className={styles.settingInput}
                        value={minSignalStrength}
                        onChange={(e) => setMinSignalStrength(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                        min="1"
                        max="10"
                    />
                </div>
            </div>

            <div className={styles.openTrades}>
                <div className={styles.sectionTitle}>Open Positions</div>
                {openTrades.length > 0 ? (
                    <div className={styles.tradesList}>
                        {openTrades.map((trade, idx) => (
                            <div
                                key={idx}
                                className={`${styles.tradeItem} ${trade.side === 'BUY' ? styles.tradeBuy : styles.tradeSell}`}
                            >
                                <span className={styles.tradeSymbol}>{trade.symbol}</span>
                                <span className={styles.tradeDetails}>
                                    {trade.side} {trade.quantity.toFixed(4)} @ ${trade.price.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.noTrades}>No open positions</div>
                )}
            </div>

            <button
                className={styles.killSwitchBtn}
                onClick={handleKillSwitch}
                disabled={!isConnected}
            >
                🛑 KILL SWITCH
            </button>
        </div>
    );
};

export default AutoTradingPanel;
