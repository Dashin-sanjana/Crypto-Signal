import React, { useMemo, useState } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { useTradingContext } from '../../contexts/TradingContext';
import SignalDisplay from '../TechnicalAnalysis/SignalDisplay';
import AutoTradingPanel from '../AutoTrading/AutoTradingPanel';
import styles from './TradingDashboard.module.css';

const TradingDashboard: React.FC = () => {
  const {
    selectedSymbol,
    prices,
    recommendation,
    tpslData,
    tradeDirection,
    watchlist,
    multiSymbolSignals,
  } = usePriceContext();

  const {
    autoTradingEnabled,
    isConnected,
    riskStatus,
    openTrades,
    minSignalStrength,
    botLog,
    getEligibleSymbols,
  } = useTradingContext();

  const currentPrice = selectedSymbol ? prices[selectedSymbol]?.price : undefined;

  const eligibleSymbols = useMemo(() => getEligibleSymbols(), [getEligibleSymbols]);

  const [logFilterSymbol, setLogFilterSymbol] = useState<string>('ALL');

  const hasStrongSignal =
    recommendation &&
    (recommendation.action === 'STRONG BUY' || recommendation.action === 'STRONG SELL');

  const meetsConfidence =
    recommendation && recommendation.confidence >= minSignalStrength * 10;

  const hasPositionInSymbol = !!selectedSymbol &&
    openTrades.some((t) => t.symbol === selectedSymbol);

  const signalSide =
    recommendation && recommendation.action.includes('BUY') ? 'BUY' : 'SELL';

  const directionMatches =
    recommendation &&
    ((signalSide === 'BUY' && tradeDirection === 'BUY') ||
      (signalSide === 'SELL' && tradeDirection === 'SELL'));

  return (
    <div className={styles.dashboard}>
      {/* Status Bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <div className={styles.symbol}>
            <span className={styles.symbolLabel}>Symbol</span>
            <span className={styles.symbolValue}>{selectedSymbol || '—'}</span>
          </div>
          <div className={styles.price}>
            <span className={styles.priceLabel}>Price</span>
            <span className={styles.priceValue}>
              {currentPrice ? currentPrice.toFixed(6) : '—'}
            </span>
          </div>
        </div>

        <div className={styles.statusCenter}>
          <div className={styles.signalSummary}>
            <span className={styles.signalLabel}>Signal</span>
            <span className={styles.signalAction}>
              {recommendation ? recommendation.action : 'WAITING'}
            </span>
            <span className={styles.signalConfidence}>
              {recommendation ? `${recommendation.confidence}%` : '—'}
            </span>
          </div>
        </div>

        <div className={styles.statusRight}>
          <div
            className={`${styles.badge} ${
              autoTradingEnabled ? styles.badgeOn : styles.badgeOff
            }`}
          >
            {autoTradingEnabled ? 'AUTO-TRADE: ON' : 'AUTO-TRADE: OFF'}
          </div>
          <div
            className={`${styles.badge} ${
              isConnected ? styles.badgeOn : styles.badgeOff
            }`}
          >
            {isConnected ? 'SERVER: CONNECTED' : 'SERVER: DISCONNECTED'}
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* Left: Signal & Conditions */}
        <div className={styles.leftColumn}>
          <SignalDisplay />

          <div className={styles.conditionsCard}>
            <div className={styles.sectionTitle}>Auto-Trade Conditions</div>
            <ul className={styles.conditionList}>
              <li>
                <span>{autoTradingEnabled ? '✓' : '✗'}</span>
                <span>Auto trading enabled</span>
              </li>
              <li>
                <span>{isConnected ? '✓' : '✗'}</span>
                <span>Trading server connected</span>
              </li>
              <li>
                <span>
                  {riskStatus?.tradingAllowed ? '✓' : '✗'}
                </span>
                <span>
                  Risk allows trading
                  {riskStatus?.killSwitchActive ? ' (kill switch active)' : ''}
                </span>
              </li>
              <li>
                <span>{hasStrongSignal ? '✓' : '✗'}</span>
                <span>Strong signal (STRONG BUY/SELL)</span>
              </li>
              <li>
                <span>{meetsConfidence ? '✓' : '✗'}</span>
                <span>
                  Confidence ≥ {minSignalStrength * 10}%
                </span>
              </li>
              <li>
                <span>{!hasPositionInSymbol ? '✓' : '✗'}</span>
                <span>No existing position in {selectedSymbol || 'symbol'}</span>
              </li>
              <li>
                <span>{directionMatches ? '✓' : '✗'}</span>
                <span>Direction matches selected ({tradeDirection})</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Auto-Trade & Risk + Open Positions + Log */}
        <div className={styles.rightColumn}>
          <AutoTradingPanel />

          {/* Bot Coins overview */}
          <div className={styles.positionsCard}>
            <div className={styles.sectionTitle}>
              Bot Coins ({eligibleSymbols.length})
            </div>
            {eligibleSymbols.length === 0 ? (
              <div className={styles.emptyState}>No BOT-enabled symbols</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Action</th>
                    <th>Conf%</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleSymbols.map((sym) => {
                    const signal = multiSymbolSignals[sym];
                    const hasOpen = openTrades.some(t => t.symbol === sym);
                    let status = 'NO DATA';

                    if (hasOpen) {
                      status = 'OPEN TRADE';
                    } else if (!riskStatus?.tradingAllowed) {
                      status = 'BLOCKED';
                    } else if (signal) {
                      const strong = (signal.action === 'STRONG BUY' || signal.action === 'STRONG SELL') &&
                        signal.confidence >= minSignalStrength * 10;
                      status = strong ? 'READY' : 'WEAK';
                    }

                    return (
                      <tr key={sym}>
                        <td>{sym}</td>
                        <td>{signal ? signal.action : 'WAITING'}</td>
                        <td>{signal ? signal.confidence : '—'}</td>
                        <td>{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.positionsCard}>
            <div className={styles.sectionTitle}>Open Positions</div>
            {openTrades.length === 0 ? (
              <div className={styles.emptyState}>No open positions</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Entry</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((t, idx) => (
                    <tr key={idx}>
                      <td>{t.symbol}</td>
                      <td>{t.side}</td>
                      <td>{t.quantity.toFixed(4)}</td>
                      <td>{t.price.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.logCard}>
            <div className={styles.sectionTitle}>Bot Activity</div>
            <div className={styles.logFilter}>
              <label>
                Symbol:&nbsp;
                <select
                  value={logFilterSymbol}
                  onChange={(e) => setLogFilterSymbol(e.target.value)}
                >
                  <option value="ALL">ALL</option>
                  {Array.from(new Set(botLog.map(l => l.symbol).filter(Boolean))).map(sym => (
                    <option key={sym as string} value={sym as string}>
                      {sym}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {botLog.length === 0 ? (
              <div className={styles.emptyState}>No recent activity</div>
            ) : (
              <ul className={styles.logList}>
                {botLog
                  .slice(-50)
                  .reverse()
                  .filter(entry => logFilterSymbol === 'ALL' || entry.symbol === logFilterSymbol)
                  .slice(0, 20)
                  .map((entry, idx) => (
                  <li key={idx} className={styles.logItem}>
                    <span className={styles.logMeta}>
                      {new Date(entry.timestamp).toLocaleTimeString()} •{' '}
                      {entry.symbol || '—'} • {entry.type}
                    </span>
                    <span className={styles.logMessage}>{entry.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;

