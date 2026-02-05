import React, { useState, useEffect } from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import { useSignalContext } from '../../contexts/SignalContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Power, Save, Zap, Activity } from "lucide-react";

const BotControl: React.FC = () => {
  const {
    botRunning,
    botMode,
    botConfig,
    balance,
    dailyPnl,
    autoTradingEnabled,
    autoTradingMinStrength,
    setAutoTradingEnabled,
    setAutoTradingMinStrength,
    startBot,
    stopBot,
    updateBotConfig,
    triggerBotCycle,
    activateKillSwitch,
    isConnected,
    isLoading,
  } = useTradingContext();
  
  const { activeSignals, scanMarkets } = useSignalContext();
  const [isScanning, setIsScanning] = useState(false);

  const [localConfig, setLocalConfig] = useState({
    dryRun: botMode === 'dry_run',
    maxPositions: botConfig?.max_positions || 5,
    dailyLossLimit: botConfig?.daily_loss_limit_percent || 1.0,
    perTradeRisk: botConfig?.per_trade_risk_percent || 0.5,
    cycleInterval: botConfig?.cycle_interval_minutes || 15,
  });

  useEffect(() => {
    if (botConfig) {
      setLocalConfig({
        dryRun: botMode === 'dry_run',
        maxPositions: botConfig.max_positions,
        dailyLossLimit: botConfig.daily_loss_limit_percent,
        perTradeRisk: botConfig.per_trade_risk_percent,
        cycleInterval: botConfig.cycle_interval_minutes,
      });
    }
  }, [botConfig, botMode]);

  const handleStartStop = async () => {
    if (botRunning) {
      await stopBot();
    } else {
      await startBot();
    }
  };

  const handleSaveConfig = async () => {
    await updateBotConfig({
      dry_run: localConfig.dryRun,
      max_positions: localConfig.maxPositions,
      daily_loss_limit_percent: localConfig.dailyLossLimit,
      per_trade_risk_percent: localConfig.perTradeRisk,
      cycle_interval_minutes: localConfig.cycleInterval,
    });
  };

  const handleKillSwitch = async () => {
    await activateKillSwitch();
  };

  const hasConfigChanges = botConfig && (
    localConfig.dryRun !== (botMode === 'dry_run') ||
    localConfig.maxPositions !== botConfig.max_positions ||
    localConfig.dailyLossLimit !== botConfig.daily_loss_limit_percent ||
    localConfig.perTradeRisk !== botConfig.per_trade_risk_percent ||
    localConfig.cycleInterval !== botConfig.cycle_interval_minutes
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-bold">Trading Bot Control</CardTitle>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'} animate-pulse`} />
          <span className="text-xs font-medium text-muted-foreground">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-6 overflow-y-auto pr-2">
        {/* Bot Status */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex justify-between gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <Badge variant={botRunning ? "default" : "destructive"} className={botRunning ? "bg-green-500 hover:bg-green-600" : ""}>
                  {botRunning ? 'Running' : 'Stopped'}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Mode</span>
              <span className="font-semibold text-sm">
                {botMode === 'dry_run' ? 'Paper Trading' : 'Live Trading'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Balance</span>
              <span className="text-lg font-bold">${balance.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Daily P&L</span>
              <span className={`text-lg font-bold ${dailyPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${dailyPnl.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className={`flex-1 ${botRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
              onClick={handleStartStop}
              disabled={isLoading}
            >
              {isLoading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : botRunning ? <Power className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {botRunning ? 'Stop Bot' : 'Start Bot'}
            </Button>
            <Button
              variant="outline"
              onClick={triggerBotCycle}
              disabled={isLoading || !botRunning}
            >
              <Zap className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Signal Status */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Active Signals</span>
            <Badge variant={activeSignals.length > 0 ? "default" : "secondary"}>
              {activeSignals.length}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => {
              setIsScanning(true);
              try {
                await scanMarkets();
              } finally {
                setIsScanning(false);
              }
            }}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Activity className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Scan Markets Now
              </>
            )}
          </Button>
        </div>

        <Separator />

        {/* Auto-Trading Settings */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Auto-Trading</h4>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-trading" className="flex flex-col gap-1">
              <span>Enable Auto-Trading</span>
              <span className="font-normal text-xs text-muted-foreground">Automatically execute trades</span>
            </Label>
            <Switch
              id="auto-trading"
              checked={autoTradingEnabled}
              onCheckedChange={setAutoTradingEnabled}
            />
          </div>

          {autoTradingEnabled && (
            <div className="space-y-2">
              <Label htmlFor="min-strength" className="text-xs">Min Signal Strength (1-10)</Label>
              <Input
                id="min-strength"
                type="number"
                min="1"
                max="10"
                value={autoTradingMinStrength}
                onChange={(e) => setAutoTradingMinStrength(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Signals with strength ≥ {autoTradingMinStrength}/10 will auto-execute
              </p>
            </div>
          )}
          
          {!autoTradingEnabled && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                ⚠️ Auto-trading is disabled. Enable it above to automatically execute trades from signals.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Risk Settings */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Risk Settings</h4>

          <div className="flex items-center justify-between">
            <Label htmlFor="dry-run" className="flex flex-col gap-1">
              <span>Paper Trading (Dry Run)</span>
              <span className="font-normal text-xs text-muted-foreground">Simulate trades without real money</span>
            </Label>
            <Switch
              id="dry-run"
              checked={localConfig.dryRun}
              onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, dryRun: checked }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-positions" className="text-xs">Max Positions</Label>
              <Input
                id="max-positions"
                type="number"
                min="1"
                max="20"
                value={localConfig.maxPositions}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, maxPositions: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loss-limit" className="text-xs">Daily Loss Limit (%)</Label>
              <Input
                id="loss-limit"
                type="number"
                min="0.5"
                max="5"
                step="0.1"
                value={localConfig.dailyLossLimit}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, dailyLossLimit: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk-per-trade" className="text-xs">Per Trade Risk (%)</Label>
            <Input
              id="risk-per-trade"
              type="number"
              min="0.1"
              max="2"
              step="0.1"
              value={localConfig.perTradeRisk}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, perTradeRisk: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycle-interval" className="text-xs">Cycle Interval</Label>
            <Select
              value={localConfig.cycleInterval.toString()}
              onValueChange={(value) => setLocalConfig(prev => ({ ...prev, cycleInterval: Number(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasConfigChanges && (
            <Button
              className="w-full"
              onClick={handleSaveConfig}
              disabled={isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          )}
        </div>

        <Separator />

        {/* Kill Switch */}
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <h4 className="mb-2 font-bold text-destructive">Emergency Kill Switch</h4>
          <p className="mb-4 text-xs text-muted-foreground">
            This will stop the bot and close ALL positions immediately.
          </p>
          <Button
            variant="destructive"
            className="w-full font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-all"
            onClick={handleKillSwitch}
            disabled={isLoading}
          >
            KILL SWITCH
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BotControl;
