import { href, useRoute } from './router';
import { DrillScreen } from './screens/DrillScreen';
import { NotFound } from './screens/NotFound';
import { SettingsScreen } from './screens/SettingsScreen';
import { UnitMap } from './screens/UnitMap';
import { UnitScreen } from './screens/UnitScreen';

export function App() {
  const route = useRoute();
  return (
    <>
      <header className="topbar">
        <a className="brand" href={href({ name: 'home' })}>
          Français
        </a>
        <nav>
          <a href={href({ name: 'settings' })} aria-current={route.name === 'settings' ? 'page' : undefined}>
            Settings
          </a>
        </nav>
      </header>
      <main>
        {route.name === 'home' && <UnitMap />}
        {route.name === 'unit' && <UnitScreen id={route.id} />}
        {route.name === 'drill' && <DrillScreen key={`${route.id}-${route.mode}`} id={route.id} mode={route.mode} />}
        {route.name === 'settings' && <SettingsScreen />}
        {route.name === 'not-found' && <NotFound what={`page "${route.path}"`} />}
      </main>
    </>
  );
}
