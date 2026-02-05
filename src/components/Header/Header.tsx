import { useSignalContext } from '../../contexts/SignalContext';
import { usePriceContext } from '../../contexts/PriceContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Settings, Activity } from 'lucide-react';

const Header = () => {
  const { activeSignals } = useSignalContext();
  const { isConnected } = usePriceContext();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 font-bold text-white shadow-lg shadow-blue-500/20">
          ₿
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Crypto <span className="text-primary">Trader</span>
        </h1>
      </div>

      <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Signals</span>
          <span className="text-lg font-bold text-primary drop-shadow-sm">{activeSignals.length}</span>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-secondary/50 px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'} animate-pulse`} />
          <span>{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant={isConnected ? "outline" : "destructive"} size="sm" className="hidden sm:flex">
          {isConnected ? 'Connected' : 'Connecting...'}
        </Button>

        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {activeSignals.length > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 w-4 justify-center p-0 text-[10px]">
              {activeSignals.length}
            </Badge>
          )}
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
