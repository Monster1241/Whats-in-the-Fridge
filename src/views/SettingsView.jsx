import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchHouseholdMembers, removeHouseholdMember, sendPasswordResetEmail } from '../api.js';
import { LegalFooterLinks } from '../components/LegalFooterLinks.jsx';
import { UserFeedbackForm } from '../components/UserFeedbackForm.jsx';
import { SupportChatPanel } from '../components/SupportChatPanel.jsx';
import { usePushNotifications } from '../context/PushNotificationContext.jsx';
import {
  countEnabledModules,
  getEnabledModuleList,
  isModuleEnabled,
  MODULE_DEFINITIONS,
  MODULE_KEYS,
  normalizeEnabledModules,
} from '../inventory/modules.js';
import { EXPIRING_SOON_DAYS } from '../inventory/expiryDisplay.js';
import {
  DIETARY_PREFERENCE_OPTIONS,
  getDietaryPreferenceLabel,
  normalizeDietaryPreference,
} from '../recipes/dietaryPreferences.js';
import {
  isValidAustralianPostcode,
  POSTCODE_CHANGE_EVENT,
  readStoredPostcode,
  writeStoredPostcode,
} from '../inventory/postcodeStorage.js';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ChefHat,
  Copy,
  Database,
  Flame,
  Headphones,
  Info,
  KeyRound,
  Leaf,
  Loader2,
  LogOut,
  Moon,
  Refrigerator,
  Settings,
  RotateCcw,
  Share2,
  ShoppingCart,
  MessageSquare,
  Shield,
  Sun,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  INVENTORY_CLEAR_BACKUP_DAYS,
  formatClearBackupSubtitle,
  isInventoryClearBackupActive,
} from '../inventory/clearBackup.js';
import { MetaIcon } from '../components/MetaIcon.jsx';

/** Viewport-centered confirm dialog (portaled so it is not trapped in the settings tab). */
function SettingsModal({ titleId, children, onClose }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="surface-card w-full max-w-md p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function SettingsInfoScreen({ title, icon: Icon, onBack, children }) {
  return (
    <div className="pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-muted mb-5 inline-flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm font-semibold transition hover:text-emerald-700 active:scale-[0.98] dark:hover:text-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </button>
      <header className="mb-5">
        <h1 className="text-heading flex items-center gap-2 text-xl font-extrabold tracking-tight">
          {Icon ? <Icon className="h-5 w-5 text-emerald-600" aria-hidden /> : null}
          {title}
        </h1>
      </header>
      <div className="surface-card space-y-4 p-4 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function SettingsNavRow({ icon: Icon, iconClassName, title, subtitle, onClick, trailing }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-zinc-900/60"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-heading block text-sm font-bold">{title}</span>
        {subtitle ? (
          <span className="text-muted mt-0.5 block truncate text-xs leading-relaxed">{subtitle}</span>
        ) : null}
      </span>
      {trailing ?? <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
    </button>
  );
}

function AppGuideSection({ enabledModules, onShowTipsAgain }) {
  const [open, setOpen] = useState(false);
  const showRecipes = isModuleEnabled(enabledModules, MODULE_KEYS.FOOD);

  const sections = [
    {
      icon: Refrigerator,
      title: 'Home — track what you have',
      steps: [
        'Use Search at the top to find an item, move it to shopping, mark it restocked, or edit it.',
        'Type a name for suggestions, scan a barcode, or use Scan receipt / upload invoice to add a whole grocery shop at once.',
        'Switch Ambient, Fresh, and Freezer to organise pantry, fridge, and frozen items.',
        'Pantry (Ambient) quantities show as total grams or ml — e.g. two 400g tins display as 800g total.',
        'Tap a row\'s status badge to edit quantity, expiry, storage, or mark an item out of stock.',
        `Items past their expiry date appear under Expired with a rose badge.`,
        `Items expiring within ${EXPIRING_SOON_DAYS} days appear under Expiring Soon with an amber badge.`,
        'Mark items as running low in the editor, or let Predicted low / Almost finished flag staples from how long they last in your home.',
        'Use More options when adding to pick Home Essentials or Baby Care categories.',
      ],
    },
    {
      icon: ShoppingCart,
      title: 'Shopping list — what to buy',
      steps: [
        'Open the Shopping tab for your household\'s shared buy list.',
        'Add items with + — matching names merge quantities instead of creating duplicates.',
        'Tap a store badge to save where your household buys each item.',
        'After you purchase something, tap Add to pantry on that row. It leaves the list and appears in Fridge with a suggested use-by date.',
        'Ingredients added from Recipes, and deals you tap Add to shopping list, land here with the same merge.',
        'Use Frequently restocked to quickly add staples you buy often.',
        'Ping partner to shop sends a reminder to other household members (item names are not in the notification).',
      ],
    },
    {
      icon: Flame,
      title: 'Hot deals — weekly specials',
      steps: [
        'Browse supermarket deals on the Deals tab (Woolworths, Coles, ALDI, and more).',
        'Tap Add to shopping list on a deal to send it straight to your shared buy list.',
        'Deals are refreshed on a schedule — check back each week for new specials.',
      ],
    },
    ...(showRecipes
      ? [
          {
            icon: ChefHat,
            title: 'Recipes — Scout, AI & catalogue',
            steps: [
              'Fridge Scout tab — chat with Scout for meal ideas, tweaks, and kitchen help.',
              'Scout replies now render with cleaner sections, lists, and recipe formatting so suggestions are easier to follow.',
              'Recommendations — enter a craving (e.g. Thai, pasta) and tap Generate for catalogue matches plus AI recipes from your pantry.',
              'Dietary preferences also shape AI suggestions, including Gluten free, Dairy free, Nut free, Pescatarian, No beef, Vegetarian, and Vegan modes.',
              'Use View more to load extra results without scrolling through everything at once.',
              'Search finds built-in recipes and imports free meals from TheMealDB.',
              'Bookmark favourites on any recipe card.',
              'Tap Add missing ingredients to send what you still need to the shopping list (smart merge applies).',
            ],
          },
        ]
      : []),
    {
      icon: Users,
      title: 'Household — share with your partner',
      steps: [
        'Copy or share your invite code in Settings so someone can join the same fridge.',
        'Everyone in the household sees the same inventory, shopping list, and saved recipes — edits sync live.',
        'Enable push notifications in Settings for expiry alerts, partner shopping pings, and support-chat replies.',
        'Scanning a receipt? Items already on the shopping list are moved to Fridge automatically when names match.',
        'If the last person leaves by mistake, support can now help reconnect the household within the recovery window instead of losing it immediately.',
        'On your phone, use Add to Home Screen to install the app for a fullscreen experience.',
      ],
    },
    {
      icon: Settings,
      title: 'Settings — customize the app',
      steps: [
        'Turn modules on or off: Food & Kitchen, Home Essentials, and Baby Care.',
        'Switch light or dark mode, and manage household members (owners can remove people).',
        'Your account shows sign-in email, household role, and invite code. Display name is used for shopping pings.',
        'Reset your password from Your account — Firebase emails the same reset link as Forgot password. Open it, set a new password, then sign in with it.',
        'Use Show tips & color guide again under Data tools to bring welcome banners and the color guide back on Home.',
        'Clear all items only if you want to wipe inventory for everyone in the household. You can restore cleared items from Settings within 7 days.',
        'Support chat in Settings lets you message the team directly, and replies can arrive as push notifications on enabled devices.',
      ],
    },
  ];

  return (
    <section className="surface-card mb-5 overflow-hidden p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-heading flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <BookOpen className="h-4 w-4 text-sky-600" aria-hidden />
            How to use the app
          </h2>
          {!open && (
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Search, pantry totals, receipts, Scout recipes, support chat, and household sharing
            </p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-600">
          <p className="text-muted text-sm leading-relaxed">
            What&apos;s in the Fridge keeps a shared household inventory for Australian homes. Search
            what you have, scan receipts, learn how long staples last, shop together, and cook from
            Recipes. Invite your partner with the code in Settings so you stay in sync, and use
            Support chat in Settings if you need account or household help.
          </p>

          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="surface-inset rounded-xl p-3">
                <h3 className="text-heading flex items-center gap-2 text-sm font-bold">
                  <Icon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  {section.title}
                </h3>
                <ol className="text-muted mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            );
          })}

          <div className="rounded-xl border border-black/[0.08] bg-lm-inset/80 p-3 dark:border-slate-600 dark:bg-dm-inset">
            <p className="text-heading flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <Info className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              Color badges
            </p>
            <ul className="text-muted mt-2 space-y-1 text-xs leading-relaxed">
              <li>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Green</span>{' '}
                — in stock / plentiful
              </li>
              <li>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Amber</span>{' '}
                — expiring within {EXPIRING_SOON_DAYS} days
              </li>
              <li>
                <span className="font-semibold text-orange-600 dark:text-orange-400">Orange</span>{' '}
                — almost finished or marked low
              </li>
              <li>
                <span className="font-semibold text-rose-700 dark:text-rose-400">Rose</span>{' '}
                — out of stock (adds to shopping list)
              </li>
              <li>
                <span className="font-semibold text-sky-700 dark:text-sky-400">Sky</span>{' '}
                — shopping tab and buy-list actions
              </li>
            </ul>
          </div>

          {onShowTipsAgain && (
            <button
              type="button"
              onClick={onShowTipsAgain}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Show welcome tips &amp; color guide again on Home
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PushNotificationsSettings() {
  const { status, error, enablePush, permission, vapidConfigured, isNative } =
    usePushNotifications();
  const [busy, setBusy] = useState(false);
  const enabled = status === 'enabled';
  const canEnable = !busy && status !== 'loading' && status !== 'unsupported' && vapidConfigured;

  const runEnable = async () => {
    setBusy(true);
    try {
      await enablePush();
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (enabled || !canEnable) return;
    await runEnable();
  };

  let statusLabel = 'Not enabled';
  if (enabled) statusLabel = 'Enabled on this device';
  else if (status === 'loading' || busy) statusLabel = 'Setting up…';
  else if (status === 'denied' || (!isNative && permission === 'denied')) {
    statusLabel = isNative
      ? 'Blocked in device settings'
      : 'Blocked in browser settings';
  } else if (status === 'unsupported') {
    statusLabel = isNative ? 'Not supported on this device' : 'Not supported in this browser';
  } else if (!vapidConfigured) statusLabel = 'Web Push key not configured';

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Bell className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-heading text-sm font-bold">Push notifications</p>
          <p className="text-muted mt-0.5 text-xs">
            Status:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{statusLabel}</span>
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable Push Notifications"
          onClick={handleToggle}
          disabled={!canEnable && !enabled}
          className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 ${
            enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}
      {enabled ? (
        <button
          type="button"
          onClick={runEnable}
          disabled={busy || status === 'loading'}
          className="mt-2 w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 transition active:scale-[0.98] disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
        >
          Refresh push registration
        </button>
      ) : null}
    </div>
  );
}

export function SettingsView({
  settings,
  updateSettings,
  inventoryClearBackup,
  onClearAllItems,
  onRestoreClearedItems,
  onboarding,
  householdCode,
  enabledModules,
  onUpdateEnabledModules,
  accountEmail,
  onLogout,
  onDeleteAccount,
  onLeaveHousehold,
}) {
  const { resetOnboarding } = onboarding ?? {};
  const [name, setName] = useState(settings?.user?.name ?? '');
  const [email, setEmail] = useState(settings?.user?.email || accountEmail || '');
  const [postcode, setPostcode] = useState(() => readStoredPostcode());
  const [postcodeError, setPostcodeError] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [members, setMembers] = useState([]);
  const [currentUserIsOwner, setCurrentUserIsOwner] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');
  const [modulesBusy, setModulesBusy] = useState(false);
  const [modulesError, setModulesError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);
  const [infoScreen, setInfoScreen] = useState(null);

  const enabledModulesSummary = useMemo(
    () =>
      getEnabledModuleList(enabledModules)
        .map((mod) => mod.label)
        .join(' · '),
    [enabledModules],
  );

  useEffect(() => {
    const openFromHash = () => {
      const hash = String(window.location.hash || '').replace(/^#/, '');
      if (hash === 'support' || hash === 'support-chat') {
        setInfoScreen('support');
      }
      if (hash === 'feedback') {
        setInfoScreen('feedback');
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError('');
    try {
      const data = await fetchHouseholdMembers();
      setMembers(data.members || []);
      setCurrentUserIsOwner(Boolean(data.currentUserIsOwner));
    } catch (err) {
      setMembersError(err.message || 'Could not load household members.');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setName(settings?.user?.name ?? '');
    setEmail(settings?.user?.email || accountEmail || '');
  }, [settings?.user?.name, settings?.user?.email, accountEmail]);

  useEffect(() => {
    const syncPostcode = (event) => {
      const next = event?.detail?.postcode || readStoredPostcode();
      setPostcode(next);
      setPostcodeError('');
    };
    window.addEventListener(POSTCODE_CHANGE_EVENT, syncPostcode);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncPostcode();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(POSTCODE_CHANGE_EVENT, syncPostcode);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const saveProfile = () => {
    const digits = String(postcode ?? '').replace(/\D/g, '').slice(0, 4);
    if (digits.length > 0 && !isValidAustralianPostcode(digits)) {
      setPostcodeError('Enter a valid 4-digit Australian postcode.');
      return;
    }
    if (digits.length === 4) {
      writeStoredPostcode(digits);
      setPostcode(digits);
    }
    setPostcodeError('');
    updateSettings((prev) => ({
      ...prev,
      user: { name: name.trim(), email: email.trim() },
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setTheme = (theme) => {
    updateSettings((prev) => ({ ...prev, theme }));
  };

  const setDietaryPreference = (dietaryPreference) => {
    updateSettings((prev) => ({
      ...prev,
      dietaryPreference: normalizeDietaryPreference(dietaryPreference),
    }));
  };

  const activeDietaryPreference = normalizeDietaryPreference(settings?.dietaryPreference);

  const handleModuleToggle = async (moduleKey, checked) => {
    setModulesError('');
    const current = normalizeEnabledModules(enabledModules);
    const next = { ...current, [moduleKey]: checked };
    const enabledCount = [next.food, next.homeEssentials, next.babyCare].filter(Boolean).length;
    if (enabledCount === 0) {
      setModulesError('Keep at least one module enabled on your dashboard.');
      return;
    }
    setModulesBusy(true);
    try {
      await onUpdateEnabledModules({ [moduleKey]: checked });
    } catch (err) {
      setModulesError(err.message || 'Could not update modules.');
    } finally {
      setModulesBusy(false);
    }
  };

  const inviteMessage = householdCode
    ? `Join our household on What's in the Fridge! Invite code: ${householdCode}`
    : 'Loading invite code…';

  const copyInviteCode = async () => {
    if (!householdCode) return;
    try {
      await navigator.clipboard.writeText(householdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const shareInvite = async () => {
    if (!householdCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join our fridge",
          text: inviteMessage,
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copyInviteCode();
  };

  const canRestoreClearedItems = isInventoryClearBackupActive(inventoryClearBackup);
  const restoreSubtitle = formatClearBackupSubtitle(inventoryClearBackup);

  const handleClearAllItems = async () => {
    setClearBusy(true);
    setClearError('');
    try {
      await onClearAllItems();
      setShowClearConfirm(false);
    } catch (err) {
      setClearError(err.message || 'Could not clear inventory.');
    } finally {
      setClearBusy(false);
    }
  };

  const handleRestoreClearedItems = async () => {
    setRestoreBusy(true);
    setRestoreError('');
    try {
      await onRestoreClearedItems();
      setShowRestoreConfirm(false);
    } catch (err) {
      setRestoreError(err.message || 'Could not restore inventory.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const signInEmail = String(accountEmail || '').trim();
  const profileEmail = String(email || '').trim();
  const resetTargetEmail = signInEmail || profileEmail;

  const handlePasswordReset = async () => {
    setResetFeedback(null);
    if (!resetTargetEmail) {
      setResetFeedback({
        type: 'error',
        text: 'No email on this account. Add one above, then try again.',
      });
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(resetTargetEmail);
      setResetFeedback({
        type: 'success',
        text: `If an account exists for ${resetTargetEmail}, Firebase sent a password reset link. Open that email, set a new password, then sign in again with it.`,
      });
    } catch (err) {
      setResetFeedback({
        type: 'error',
        text: err.message || 'Could not send password reset email.',
      });
    } finally {
      setResetBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await onDeleteAccount();
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete account.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemoveMember) return;
    setRemoveBusy(true);
    setMemberActionError('');
    try {
      const data = await removeHouseholdMember(confirmRemoveMember.id);
      setMembers(data.members || []);
      setConfirmRemoveMember(null);
    } catch (err) {
      setMemberActionError(err.message || 'Could not remove member.');
    } finally {
      setRemoveBusy(false);
    }
  };

  const handleLeaveHousehold = async () => {
    setLeaveBusy(true);
    setMemberActionError('');
    try {
      await onLeaveHousehold();
      setShowLeaveConfirm(false);
    } catch (err) {
      setMemberActionError(err.message || 'Could not leave household.');
    } finally {
      setLeaveBusy(false);
    }
  };

  if (infoScreen === 'privacy') {
    return (
      <SettingsInfoScreen title="Your privacy" icon={Shield} onBack={() => setInfoScreen(null)}>
        <p className="text-muted">
          We never sell your inventory, receipts, or chat messages. Household data is shared only with
          people you invite. We use non-sensitive usage patterns (like how long items last in your
          home, which features you use, and when items are AI-sorted) to improve predictions for your
          household and to make the product more reliable — not to share your shopping habits
          externally. Receipt photos are processed for scanning and are not kept on our servers
          afterward.
        </p>
        <p className="text-muted">
          Smart learning remembers how you categorize items and how long they last. Usage counts are
          privacy-safe (no item names stored in analytics).
        </p>
        <p className="text-muted">
          See the full{' '}
          <a href="/privacy" className="font-semibold text-emerald-700 underline dark:text-emerald-400">
            Privacy Policy
          </a>{' '}
          for details.
        </p>
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'dataSources') {
    return (
      <SettingsInfoScreen title="Data sources" icon={Database} onBack={() => setInfoScreen(null)}>
        <p className="text-muted">
          Barcode product names and categories are looked up from{' '}
          <a
            href="https://au.openfoodfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            Open Food Facts
          </a>{' '}
          and{' '}
          <a
            href="https://au.openproductsfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            Open Products Facts
          </a>{' '}
          (Australian and worldwide databases). Use-by dates are estimated from product data or
          typical shelf life when not printed on the pack.
        </p>
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'support') {
    return (
      <SettingsInfoScreen title="Support chat" icon={Headphones} onBack={() => setInfoScreen(null)}>
        <SupportChatPanel />
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'feedback') {
    return (
      <SettingsInfoScreen title="Send feedback" icon={MessageSquare} onBack={() => setInfoScreen(null)}>
        <p className="text-muted mb-4 text-sm">
          Share a bug, feature idea, or anything about deals and catalogues. For account or data
          problems, use Support chat so we can dig in.
        </p>
        <UserFeedbackForm />
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'appearance') {
    return (
      <SettingsInfoScreen title="Appearance" icon={Sun} onBack={() => setInfoScreen(null)}>
        <p className="text-muted">Choose light or dark mode for the app.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
              settings.theme === 'light'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <Sun className="h-5 w-5" />
            Light
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
              settings.theme === 'dark'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <Moon className="h-5 w-5" />
            Dark
          </button>
        </div>
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'dietary') {
    return (
      <SettingsInfoScreen title="Dietary preferences" icon={Leaf} onBack={() => setInfoScreen(null)}>
        {activeDietaryPreference !== 'none' && (
          <div
            className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/40"
            role="note"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
              Scout tries to follow your diet, but always double-check ingredients — especially for
              allergies or hidden animal products (e.g. fish sauce, gelatin, stock).
            </p>
          </div>
        )}
        <div className="space-y-2">
          {DIETARY_PREFERENCE_OPTIONS.map((option) => {
            const selected = activeDietaryPreference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDietaryPreference(option.value)}
                className={`surface-inset w-full rounded-xl border-2 p-3 text-left transition active:scale-[0.99] ${
                  selected
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-transparent'
                }`}
                aria-pressed={selected}
              >
                <p className="text-heading text-sm font-semibold">{option.label}</p>
                <p className="text-muted mt-0.5 text-xs leading-relaxed">{option.description}</p>
              </button>
            );
          })}
        </div>
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'dashboard') {
    return (
      <SettingsInfoScreen title="Customize Dashboard" icon={Settings} onBack={() => setInfoScreen(null)}>
        <p className="text-muted">
          Choose what your household tracks. Changes sync for everyone when the app refreshes.
        </p>
        <div className="space-y-2">
          {MODULE_DEFINITIONS.map((mod) => {
            const checked = normalizeEnabledModules(enabledModules)[mod.key];
            const onlyOneLeft = checked && countEnabledModules(enabledModules) === 1;
            return (
              <label
                key={mod.key}
                className={`surface-inset flex cursor-pointer items-start gap-3 rounded-xl p-3 transition ${
                  modulesBusy ? 'pointer-events-none opacity-60' : ''
                } ${checked ? 'ring-1 ring-emerald-400/60 dark:ring-emerald-600/50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={modulesBusy || onlyOneLeft}
                  onChange={(e) => handleModuleToggle(mod.key, e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-black/15 bg-lm-raised text-emerald-600 focus:ring-emerald-500 dark:border-white/20 dark:bg-dm-raised"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-heading flex items-center gap-1.5 text-sm font-semibold">
                    <MetaIcon name={mod.key} className="h-4 w-4" />
                    {mod.label}
                  </p>
                  <p className="text-muted mt-0.5 text-xs leading-relaxed">{mod.description}</p>
                  {onlyOneLeft && (
                    <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      At least one module must stay on
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
        {modulesBusy && (
          <p className="text-muted text-xs font-medium">Saving for your household…</p>
        )}
        {modulesError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {modulesError}
          </p>
        )}
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'account') {
    return (
      <SettingsInfoScreen title="Your account" icon={User} onBack={() => setInfoScreen(null)}>
        <div className="space-y-3">
          <div>
            <label htmlFor="settings-name" className="text-muted mb-1 block text-xs font-semibold uppercase">
              Display name
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="input-field"
            />
            <p className="text-muted mt-1 text-[11px] leading-relaxed">
              Shown to your household for shopping pings and profile context.
            </p>
          </div>
          <div>
            <label htmlFor="settings-email" className="text-muted mb-1 block text-xs font-semibold uppercase">
              Profile email
            </label>
            <input
              id="settings-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
            />
            <p className="text-muted mt-1 text-[11px] leading-relaxed">
              Optional contact email saved on your household profile.
            </p>
          </div>
          <div>
            <label htmlFor="settings-postcode" className="text-muted mb-1 block text-xs font-semibold uppercase">
              Postcode
            </label>
            <input
              id="settings-postcode"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={4}
              value={postcode}
              onChange={(e) => {
                setPostcode(e.target.value.replace(/\D/g, '').slice(0, 4));
                setPostcodeError('');
              }}
              onBlur={() => {
                const digits = String(postcode ?? '').replace(/\D/g, '').slice(0, 4);
                if (digits.length === 4 && isValidAustralianPostcode(digits)) {
                  writeStoredPostcode(digits);
                  setPostcode(digits);
                  setPostcodeError('');
                }
              }}
              placeholder="e.g. 2000"
              className="input-field"
            />
            <p className="text-muted mt-1 text-[11px] leading-relaxed">
              Used for local supermarket catalogues on Deals. Synced with the Deals tab.
            </p>
            {postcodeError && (
              <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400" role="alert">
                {postcodeError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={saveProfile}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? 'Saved!' : 'Save profile'}
          </button>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetBusy || !resetTargetEmail}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-3 text-sm font-semibold text-emerald-900 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {resetBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {resetBusy ? 'Sending reset email…' : 'Change password'}
          </button>
          {resetFeedback && (
            <p
              role="status"
              className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                resetFeedback.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              }`}
            >
              {resetFeedback.text}
            </p>
          )}
        </div>
      </SettingsInfoScreen>
    );
  }

  if (infoScreen === 'household') {
    return (
      <>
        <SettingsInfoScreen title={"Who's in your household"} icon={Users} onBack={() => setInfoScreen(null)}>
          <p className="text-muted">
            Everyone here shares the same fridge inventory and settings.
          </p>

          {membersLoading ? (
            <p className="text-muted py-2 text-sm">Loading members…</p>
          ) : membersError ? (
            <div className="space-y-2">
              <p className="text-sm text-rose-600 dark:text-rose-400">{membersError}</p>
              <button
                type="button"
                onClick={loadMembers}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Try again
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-lm-inset px-3 py-2.5 dark:border-slate-600 dark:bg-dm-inset"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-heading truncate text-sm font-semibold">{member.email}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {member.isCurrentUser && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          You
                        </span>
                      )}
                      {member.isOwner && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>
                  {currentUserIsOwner && !member.isCurrentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemberActionError('');
                        setConfirmRemoveMember({ id: member.id, email: member.email });
                      }}
                      className="shrink-0 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 active:scale-[0.98] dark:border-rose-800 dark:text-rose-400"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setShowAddPerson((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 active:scale-[0.98] dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          >
            <UserPlus className="h-4 w-4" />
            {showAddPerson ? 'Hide invite code' : 'Add another person'}
          </button>

          {showAddPerson && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 dark:border-violet-800 dark:bg-violet-950/30">
              <p className="text-muted mb-1 text-xs font-semibold uppercase">Invite code</p>
              <p className="text-heading mb-3 font-mono text-2xl font-bold tracking-widest">
                {householdCode || '—'}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="flex items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-lm-raised py-2.5 text-sm font-semibold text-slate-800 active:scale-[0.98] dark:border-white/10 dark:bg-dm-raised dark:text-zinc-200"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy code'}
                </button>
                <button
                  type="button"
                  onClick={shareInvite}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
                >
                  <Share2 className="h-4 w-4" />
                  Share code
                </button>
              </div>
              <p className="text-muted mt-3 text-xs leading-relaxed">{inviteMessage}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setMemberActionError('');
              setShowLeaveConfirm(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 active:scale-[0.98] dark:border-slate-600 dark:text-slate-300"
          >
            <LogOut className="h-4 w-4" />
            Leave household
          </button>

          {memberActionError && (
            <p className="text-muted text-xs text-rose-600 dark:text-rose-400">{memberActionError}</p>
          )}
        </SettingsInfoScreen>

        {confirmRemoveMember && (
          <SettingsModal
            titleId="remove-member-title"
            onClose={() => !removeBusy && setConfirmRemoveMember(null)}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="remove-member-title" className="text-heading text-lg font-bold">
                  Remove from household?
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {confirmRemoveMember.email}
                  </span>{' '}
                  will lose access to this household&apos;s fridge. They can rejoin later with the
                  invite code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={removeBusy}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={removeBusy}
                onClick={handleRemoveMember}
                className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {removeBusy ? 'Removing…' : 'Yes, remove them'}
              </button>
              <button
                type="button"
                disabled={removeBusy}
                onClick={() => setConfirmRemoveMember(null)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </SettingsModal>
        )}

        {showLeaveConfirm && (
          <SettingsModal
            titleId="leave-household-title"
            onClose={() => !leaveBusy && setShowLeaveConfirm(false)}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="leave-household-title" className="text-heading text-lg font-bold">
                  Leave household?
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  You will no longer see this household&apos;s fridge inventory or settings. You can
                  create a new household or join another one with an invite code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaveBusy}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={leaveBusy}
                onClick={handleLeaveHousehold}
                className="rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
              >
                {leaveBusy ? 'Leaving…' : 'Yes, leave household'}
              </button>
              <button
                type="button"
                disabled={leaveBusy}
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </SettingsModal>
        )}
      </>
    );
  }

  return (
    <div className="pb-28">
      <header className="mb-5">
        <h1 className="text-heading flex items-center gap-2.5 text-2xl font-extrabold">
          <Settings className="h-7 w-7 text-emerald-600" aria-hidden />
          Settings
        </h1>
        <p className="text-muted mt-1.5 text-sm">Appearance, account, and household</p>
      </header>

      <AppGuideSection
        enabledModules={enabledModules}
        onShowTipsAgain={resetOnboarding}
      />

      <section className="surface-card mb-5 divide-y divide-slate-200 overflow-hidden dark:divide-slate-700">
        <SettingsNavRow
          icon={User}
          iconClassName="bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
          title="Your account"
          subtitle={name.trim() || accountEmail || 'Name, email, postcode'}
          onClick={() => setInfoScreen('account')}
        />
        <PushNotificationsSettings />
        <SettingsNavRow
          icon={Sun}
          iconClassName="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          title="Appearance"
          subtitle={settings.theme === 'dark' ? 'Dark mode' : 'Light mode'}
          onClick={() => setInfoScreen('appearance')}
        />
        <SettingsNavRow
          icon={Leaf}
          iconClassName="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          title="Dietary preferences"
          subtitle={getDietaryPreferenceLabel(activeDietaryPreference)}
          onClick={() => setInfoScreen('dietary')}
        />
        <SettingsNavRow
          icon={Settings}
          iconClassName="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          title="Customize Dashboard"
          subtitle={enabledModulesSummary || 'Choose modules'}
          onClick={() => setInfoScreen('dashboard')}
        />
        <SettingsNavRow
          icon={Users}
          iconClassName="bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
          title="Household"
          subtitle={
            membersLoading
              ? 'Loading…'
              : `${members.length} member${members.length === 1 ? '' : 's'}`
          }
          onClick={() => setInfoScreen('household')}
        />
        <SettingsNavRow
          icon={Headphones}
          iconClassName="bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
          title="Support chat"
          subtitle="Get help from the team in this chat"
          onClick={() => setInfoScreen('support')}
        />
        <SettingsNavRow
          icon={MessageSquare}
          iconClassName="bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
          title="Send feedback"
          subtitle="Bugs, ideas, and help improving deals"
          onClick={() => setInfoScreen('feedback')}
        />
        <SettingsNavRow
          icon={Shield}
          iconClassName="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          title="Your privacy"
          subtitle="How we handle household data and learning"
          onClick={() => setInfoScreen('privacy')}
        />
        <SettingsNavRow
          icon={Database}
          iconClassName="bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
          title="Data sources"
          subtitle="Open Food Facts and product lookup details"
          onClick={() => setInfoScreen('dataSources')}
        />
        <SettingsNavRow
          icon={BookOpen}
          iconClassName="bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
          title="Show tips & color guide again"
          subtitle="Replay onboarding help on Home"
          onClick={resetOnboarding}
          trailing={null}
        />
        {canRestoreClearedItems ? (
          <SettingsNavRow
            icon={RotateCcw}
            iconClassName="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            title="Restore cleared items"
            subtitle={restoreSubtitle}
            onClick={() => {
              setRestoreError('');
              setShowRestoreConfirm(true);
            }}
            trailing={null}
          />
        ) : null}
        <SettingsNavRow
          icon={Trash2}
          iconClassName="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          title="Clear all items"
          subtitle="Remove every item from your fridge"
          onClick={() => {
            setClearError('');
            setShowClearConfirm(true);
          }}
          trailing={null}
        />
        <SettingsNavRow
          icon={LogOut}
          iconClassName="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          title="Log out"
          subtitle="Sign out on this device"
          onClick={() => setShowLogoutConfirm(true)}
          trailing={null}
        />
        <SettingsNavRow
          icon={Trash2}
          iconClassName="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          title="Delete account"
          subtitle="Permanently remove your login"
          onClick={() => {
            setDeleteError('');
            setShowDeleteConfirm(true);
          }}
          trailing={null}
        />
      </section>

      {showClearConfirm && (
        <SettingsModal
          titleId="clear-items-title"
          onClose={() => setShowClearConfirm(false)}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="clear-items-title" className="text-heading text-lg font-bold">
                Clear all items?
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                This removes every item from your household fridge and shopping list. You can restore
                them from Settings within {INVENTORY_CLEAR_BACKUP_DAYS} days — after that they are
                deleted permanently.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
              disabled={clearBusy}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {clearError ? (
            <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{clearError}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleClearAllItems}
              disabled={clearBusy}
              className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {clearBusy ? 'Clearing…' : 'Yes, clear everything'}
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              disabled={clearBusy}
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </SettingsModal>
      )}

      {showRestoreConfirm && (
        <SettingsModal
          titleId="restore-items-title"
          onClose={() => !restoreBusy && setShowRestoreConfirm(false)}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="restore-items-title" className="text-heading text-lg font-bold">
                Restore cleared items?
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                This brings back {inventoryClearBackup?.itemCount ?? 0}{' '}
                {(inventoryClearBackup?.itemCount ?? 0) === 1 ? 'item' : 'items'} from before you
                cleared the fridge. Any items added since then will be replaced.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRestoreConfirm(false)}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
              disabled={restoreBusy}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {restoreError ? (
            <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{restoreError}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRestoreClearedItems}
              disabled={restoreBusy}
              className="rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {restoreBusy ? 'Restoring…' : 'Yes, restore items'}
            </button>
            <button
              type="button"
              onClick={() => setShowRestoreConfirm(false)}
              disabled={restoreBusy}
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </SettingsModal>
      )}

      {showLogoutConfirm && (
        <SettingsModal
          titleId="logout-title"
          onClose={() => setShowLogoutConfirm(false)}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="logout-title" className="text-heading text-lg font-bold">
                Log out?
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                You&apos;ll need to sign in again to access your household fridge.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setShowLogoutConfirm(false);
                onLogout();
              }}
              className="rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white active:scale-[0.98] dark:bg-slate-200 dark:text-slate-900"
            >
              Yes, log out
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </SettingsModal>
      )}

      {showDeleteConfirm && (
        <SettingsModal
          titleId="delete-account-title"
          onClose={() => !deleteBusy && setShowDeleteConfirm(false)}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="delete-account-title" className="text-heading text-lg font-bold">
                Delete your account?
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                This permanently removes your login and profile. If you are the only person in
                your household, all fridge inventory and settings for that household are deleted
                too. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteBusy}
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {deleteError && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              {deleteError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={deleteBusy}
              onClick={handleDeleteAccount}
              className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {deleteBusy ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </SettingsModal>
      )}

      <footer className="border-t border-slate-200 pt-6 dark:border-slate-700">
        <LegalFooterLinks />
        <p className="text-muted mt-2 text-center text-[10px]">
          What&apos;s in the Fridge? · Household inventory for Australia
        </p>
      </footer>
    </div>
  );
}

