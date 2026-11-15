import { useGame } from './game/store';
import { Game } from './ui/Game';
import { Menu } from './ui/Menu';

export function App() {
  const screen = useGame((s) => s.screen);
  return screen === 'menu' ? <Menu /> : <Game />;
}
