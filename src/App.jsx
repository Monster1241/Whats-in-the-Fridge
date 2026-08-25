import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { AppSplashScreen } from './components/AppSplashScreen.jsx';
import { UnloadingLoader } from './components/UnloadingLoader.jsx';
import { TabPanelLoader } from './components/TabPanelLoader.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
import { VerifyEmailScreen } from './components/VerifyEmailScreen.jsx';
import { useAppData } from './hooks/useAppData.js';
import { useAuth } from './hooks/useAuth.js';
import { PushNotificationProvider } from './context/PushNotificationContext.jsx';
import { ExpiryNotificationSync } from './components/ExpiryNotificationSync.jsx';
import { checkApiHealth } from './api.js';
import { readStoredPostcode } from './inventory/postcodeStorage.js';
import { isOnShoppingList, STATUS } from './inventory/constants.js';
import { isModuleEnabled, MODULE_KEYS } from './inventory/modules.js';
import { dealStoreToPreferred, mapDealToInventory } from './inventory/mapDealToInventory.js';
import { normalizeName } from './inventory/itemUtils.js';
import { buildConsumptionFields } from './inventory/consumption.js';
import { flowEnterClass, getStepDirection } from './utils/tabFlow.js';
import { InventoryView } from './views/InventoryView.jsx';
import { SettingsView } from './views/SettingsView.jsx';
import {
  ChefHat,
  Flame,
  Refrigerator,
  Settings,
  ShoppingCart,
} from 'lucide-react';

const WeeklyDealsFeed = lazy(() =>
  import('./components/WeeklyDealsFeed.jsx').then((m) => ({ default: m.WeeklyDealsFeed })),
);
const RecipesView = lazy(() =>
  import('./components/RecipesView.jsx').then((m) => ({ default: m.RecipesView })),
);

const MAIN_TAB_ORDER = ['fridge', 'shopping', 'deals', 'recipes', 'settings'];

function DealsView({ items, updateItems }) {
  const shoppingListNames = useMemo(
    () =>
      new Set(
        items
          .filter((item) => isOnShoppingList(item))
          .map((item) => normalizeName(item.name)),
      ),
    [items],
  );

  const addDealToShoppingList = (deal) => {
    const { itemType, category } = mapDealToInventory(deal);
    const needle = normalizeName(deal.name);
    const preferredStore = dealStoreToPreferred(deal.store);

    updateItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => normalizeName(item.name) === needle && item.itemType === itemType,
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          status: STATUS.OUT,
          category,
          preferredStore: preferredStore ?? next[existingIdx].preferredStore ?? null,
        };
        return next;
      }
      const consumption = buildConsumptionFields({ name: deal.name, itemType, category });
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: deal.name,
          itemType,
          status: STATUS.OUT,
          category,
          expiryDate: null,
          preferredStore,
          ...consumption,
        },
      ];
    });
  };

  return (
    <Suspense fallback={<TabPanelLoader />}>
      <WeeklyDealsFeed onAddDeal={addDealToShoppingList} addedNames={shoppingListNames} />
    </Suspense>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="auth-screen">
      <div className="auth-screen__mesh" aria-hidden />
      <div className="auth-screen__orb auth-screen__orb--a" aria-hidden />
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6">
        <UnloadingLoader size="sm" className="mb-5" />
        <p className="text-heading animate-fade-in text-center text-sm font-semibold">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col px-6 py-10">
      <div className="surface-card border-rose-200 p-5 dark:border-rose-800">
        <h1 className="text-heading mb-2 text-lg font-bold">Cannot connect to database</h1>
        <p className="text-muted mb-4 text-sm leading-relaxed">{error}</p>
        <ol className="text-muted mb-5 list-decimal space-y-2 pl-5 text-sm">
          <li>
            <strong>Vercel:</strong> Project → Settings → Environment Variables → add{' '}
            <code className="text-xs">MONGODB_URI</code> and <code className="text-xs">JWT_SECRET</code>, then redeploy.
          </li>
          <li>
            In MongoDB Atlas → Network Access, allow <code className="text-xs">0.0.0.0/0</code> so Vercel can connect.
          </li>
          <li>
            <strong>Local:</strong> put <code className="text-xs">MONGODB_URI=...</code> in a{' '}
            <code className="text-xs">.env</code> file and run <code className="text-xs">npm run dev</code>.
          </li>
          <li>
            Name must be exactly <code className="text-xs">MONGODB_URI</code> (not <code className="text-xs">VITE_MONGODB_URI</code>).
            Your local <code className="text-xs">.env</code> file is not uploaded to Vercel.
          </li>
          <li>
            After saving the variable, click <strong>Redeploy</strong> — old deployments do not pick up new env vars.
          </li>
          <li>
            Test: open <code className="text-xs">/api/health</code> on your site — should show{' '}
            <code className="text-xs">connected: true</code>.
          </li>
        </ol>
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}

const SPLASH_MIN_MS = 1400;

export default function App() {
  const [splashPhase, setSplashPhase] = useState('active');
  const [activeTab, setActiveTab] = useState('fridge');
  const [tabFlowDir, setTabFlowDir] = useState(0);
  const auth = useAuth();

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      readStoredPostcode();
      await checkApiHealth();

      const elapsed = Date.now() - startedAt;
      if (elapsed < SPLASH_MIN_MS) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, SPLASH_MIN_MS - elapsed);
        });
      }

      if (!cancelled) setSplashPhase('exiting');
    })();

    return () => {
      cancelled = true;
    };
  }, []);
  const appReady = auth.canUseApp;
  const {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    offlineMode,
    items,
    updateItems,
    patchItems,
    replaceItemsFromServer,
    restockHistory,
    updateRestockHistory,
    itemKnowledge,
    updateItemKnowledge,
    recordUsageEvent,
    syncUsageInsights,
    settings,
    updateSettings,
    enabledModules,
    updateEnabledModules,
    householdCode,
    inventoryClearBackup,
    clearAllItems,
    restoreClearedItems,
    savedRecipes,
    onboarding,
  } = useAppData(appReady);

  const navTabs = useMemo(() => {
    const shoppingCount = items.filter((item) => isOnShoppingList(item)).length;
    const tabs = [
      { id: 'fridge', label: 'Fridge', icon: Refrigerator, accent: 'emerald' },
      {
        id: 'shopping',
        label: 'Shopping',
        icon: ShoppingCart,
        accent: 'sky',
        badge: shoppingCount,
      },
      { id: 'deals', label: 'Deals', icon: Flame, accent: 'rose' },
    ];
    if (isModuleEnabled(enabledModules, MODULE_KEYS.FOOD)) {
      tabs.push({ id: 'recipes', label: 'Recipes', icon: ChefHat, accent: 'emerald' });
    }
    tabs.push({ id: 'settings', label: 'Settings', icon: Settings, accent: 'emerald' });
    return tabs;
  }, [enabledModules, items]);

  useEffect(() => {
    if (activeTab === 'recipes' && !isModuleEnabled(enabledModules, MODULE_KEYS.FOOD)) {
      setActiveTab('fridge');
    }
  }, [activeTab, enabledModules]);

  useEffect(() => {
    const openSupportFromHash = () => {
      const hash = String(window.location.hash || '').replace(/^#/, '');
      if (hash === 'support' || hash === 'support-chat' || hash === 'feedback') {
        setActiveTab('settings');
      }
    };
    openSupportFromHash();
    window.addEventListener('hashchange', openSupportFromHash);
    return () => window.removeEventListener('hashchange', openSupportFromHash);
  }, []);

  if (splashPhase !== 'done') {
    return (
      <AppSplashScreen
        exiting={splashPhase === 'exiting'}
        onExitComplete={() => setSplashPhase('done')}
      />
    );
  }

  if (auth.booting) {
    return <LoadingScreen message="Checking session…" />;
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        needsHousehold={false}
        error={auth.error}
        setError={auth.setError}
        onSignup={auth.signup}
        onLogin={auth.login}
        onCreateHousehold={auth.createHousehold}
        onJoinHousehold={auth.joinHousehold}
        onFinishHouseholdSetup={auth.finishHouseholdSetup}
      />
    );
  }

  if (auth.needsVerification) {
    return (
      <VerifyEmailScreen
        email={auth.user?.email}
        error={auth.error}
        setError={auth.setError}
        onCheckVerified={auth.checkVerification}
        onResend={auth.resendVerificationEmail}
        onLogout={auth.logout}
      />
    );
  }

  if (auth.needsHousehold) {
    return (
      <AuthScreen
        needsHousehold
        error={auth.error}
        setError={auth.setError}
        onSignup={auth.signup}
        onLogin={auth.login}
        onCreateHousehold={auth.createHousehold}
        onJoinHousehold={auth.joinHousehold}
        onFinishHouseholdSetup={auth.finishHouseholdSetup}
      />
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your household…" />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={() => reload()} />;
  }

  return (
    <PushNotificationProvider enabled={auth.canUseApp}>
    <ExpiryNotificationSync items={items} enabled={!loading} />
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col">
      <main className="app-main flex-1 overflow-y-auto px-4 sm:px-5">
        <div key={activeTab} className={flowEnterClass(tabFlowDir, 'animate-page')}>
        {saveError && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            Could not sync latest change. We will retry automatically on your next edit.
            <button
              type="button"
              onClick={dismissSaveError}
              className="ml-2 font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {(activeTab === 'fridge' || activeTab === 'shopping') && (
          <InventoryView
            mode={activeTab}
            items={items}
            updateItems={updateItems}
            patchItems={patchItems}
            replaceItemsFromServer={replaceItemsFromServer}
            restockHistory={restockHistory}
            updateRestockHistory={updateRestockHistory}
            itemKnowledge={itemKnowledge}
            updateItemKnowledge={updateItemKnowledge}
            recordUsageEvent={recordUsageEvent}
            syncUsageInsights={syncUsageInsights}
            onboarding={onboarding}
            enabledModules={enabledModules}
            offlineMode={offlineMode}
          />
        )}
        {activeTab === 'deals' && (
          <DealsView items={items} updateItems={updateItems} />
        )}
        {activeTab === 'recipes' && (
          <Suspense fallback={<TabPanelLoader />}>
            <RecipesView
              items={items}
              updateItems={updateItems}
              replaceItemsFromServer={replaceItemsFromServer}
              savedRecipes={savedRecipes}
              dietaryPreference={settings.dietaryPreference}
            />
          </Suspense>
        )}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            updateSettings={updateSettings}
            inventoryClearBackup={inventoryClearBackup}
            onClearAllItems={clearAllItems}
            onRestoreClearedItems={restoreClearedItems}
            onboarding={onboarding}
            householdCode={householdCode}
            enabledModules={enabledModules}
            onUpdateEnabledModules={updateEnabledModules}
            accountEmail={auth.user?.email}
            onLogout={auth.logout}
            onDeleteAccount={auth.deleteAccount}
            onLeaveHousehold={auth.leaveHousehold}
          />
        )}
        </div>
      </main>

      <nav className="nav-bar fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto flex max-w-lg px-1">
          {navTabs.map(({ id, label, icon: Icon, accent, badge }) => {
            const active = activeTab === id;
            const accentStyles =
              accent === 'rose'
                ? {
                    text: 'text-rose-600 dark:text-rose-400',
                    pill: 'bg-rose-100 dark:bg-rose-950/60',
                    bar: 'bg-rose-500',
                  }
                : accent === 'sky'
                  ? {
                      text: 'text-sky-600 dark:text-sky-400',
                      pill: 'bg-sky-100 dark:bg-sky-950/60',
                      bar: 'bg-sky-500',
                    }
                  : {
                      text: 'text-emerald-600 dark:text-emerald-400',
                      pill: 'bg-emerald-100 dark:bg-emerald-950/60',
                      bar: 'bg-emerald-500',
                    };
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTabFlowDir(getStepDirection(MAIN_TAB_ORDER, activeTab, id));
                  setActiveTab(id);
                }}
                className={`nav-tab-btn relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-bold transition-[color,transform] duration-200 active:scale-[0.96] sm:text-xs ${
                  active ? `nav-tab-btn--active ${accentStyles.text}` : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
              >
                {active && (
                  <span
                    className={`absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full transition-all duration-300 ${accentStyles.bar}`}
                    aria-hidden
                  />
                )}
                <span
                  className={`nav-tab-icon relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300 ${
                    active ? accentStyles.pill : ''
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
                  {badge > 0 && id === 'shopping' && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </PushNotificationProvider>
  );
}
