import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from './pages/home';
import LeagueGames from './pages/league-games';
import BoxScore from './pages/box-score';
import FantasyOptimizer from './pages/fantasy-optimizer';
import PlayByPlay from './pages/play-by-play';
import PlayerComparison from './pages/player-comparison';
import PlayerDetail from './pages/player-detail';
import CricketBoxScore from './pages/cricket-box-score';
import CricketOptimizer from './pages/cricket-optimizer';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      {/* ── Cricket routes ────────────────────────────────────────────────
          These MUST appear before the generic /:league routes so that
          /cricket/:competition/game/:id is not mis-matched as
          /:league/game/:id with league="cricket". */}
      <Route path="/cricket/:competition/game/:id/optimizer" component={CricketOptimizer} />
      <Route path="/cricket/:competition/game/:id" component={CricketBoxScore} />
      <Route path="/cricket/:competition" component={LeagueGames} />

      {/* ── Basketball routes ─────────────────────────────────────────── */}
      <Route path="/:league/game/:id/optimizer" component={FantasyOptimizer} />
      <Route path="/:league/game/:id/plays" component={PlayByPlay} />
      <Route path="/:league/game/:id/compare" component={PlayerComparison} />
      <Route path="/:league/player/:playerId" component={PlayerDetail} />
      <Route path="/:league/game/:id" component={BoxScore} />
      <Route path="/:league" component={LeagueGames} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
