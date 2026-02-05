
import { useNewsContext } from '../../contexts/NewsContext';
import { NEWS_SOURCES } from '../../utils/constants';
import { getTimeAgo } from '../../utils/helpers';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const NewsPanel = () => {
  const { news, filter, setFilter, loading, refreshNews } = useNewsContext();

  const getSentimentClass = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return "bg-green-500 hover:bg-green-600 border-green-600/20 text-white";
      case 'bearish': return "bg-red-500 hover:bg-red-600 border-red-600/20 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="flex h-full flex-col border-border bg-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
        <CardTitle className="text-base font-bold">News Feed</CardTitle>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={refreshNews}
          disabled={loading}
          title="Refresh News"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </CardHeader>

      <div className="flex gap-2 p-3 overflow-x-auto border-b bg-muted/20 no-scrollbar">
        <Button
          variant={filter === 'All' ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs font-bold rounded-full"
          onClick={() => setFilter('All')}
        >
          All
        </Button>
        {NEWS_SOURCES.map(({ name }) => (
          <Button
            key={name}
            variant={filter === name ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs font-bold rounded-full whitespace-nowrap"
            onClick={() => setFilter(name)}
          >
            {name}
          </Button>
        ))}
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[450px]">
          <div className="flex flex-col p-4 gap-3">
            {loading && news.length === 0 ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : news.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm">No news available</div>
            ) : (
              news.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-all hover:border-primary/50 relative overflow-hidden"
                >
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary uppercase tracking-wider">
                      {item.source}
                    </Badge>
                    <Badge className={cn("text-[10px] px-1.5 py-0 uppercase tracking-wider font-bold", getSentimentClass(item.sentiment))}>
                      {item.sentiment}
                    </Badge>
                  </div>

                  <h4 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors pr-4">
                    {item.title} <ExternalLink className="inline h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                  </h4>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <span className="text-[10px] font-medium text-muted-foreground/70">
                    {getTimeAgo(item.timestamp)}
                  </span>
                </a>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NewsPanel;
