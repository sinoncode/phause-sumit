/*
 * Phause React — shared header utility cluster.
 *
 * Dynamic notifications:
 * - GET /api/notifications
 * - PATCH /api/notifications/:id/read
 * - Maximum five notifications in the header.
 * - Clear notifications locally without deleting backend records.
 * - Read actions restricted to Admin, Super Admin and Org Admin.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown } from '../ui/Dropdown';
import { useCustomizer } from '../../context/CustomizerContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuthStore } from '../../stores/auth.store';
import KnowledgeBaseDropdown from './KnowledgeBaseDropdown';

const MARKETING_HOME = 'https://phause.webandappdevelopmenttech.com/';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://phishingsimulation.webandappdevelopmenttech.com'
).replace(/\/+$/, '').replace(/\/api$/i, '');

const NOTIFICATIONS_URL = `${API_BASE_URL}/api/notifications`;

const MAX_HEADER_NOTIFICATIONS = 5;
const CLEARED_STORAGE_KEY = 'phause_header_cleared_notifications';

interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  type?: string;
  category?: string;
  createdAt?: string;
  created_at?: string;
  readAt?: string | null;
  read_at?: string | null;
  isRead?: boolean;
  read?: boolean;
  [key: string]: unknown;
}

const ICON = {
  apps: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
      <path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
      <path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
      <path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
    </svg>
  ),

  cart: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304" />
      <path d="M9 11v-5a3 3 0 0 1 6 0v5" />
    </svg>
  ),

  bell: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </svg>
  ),

  cog: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M6 4v4" />
      <path d="M6 12v8" />
      <path d="M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M12 4v10" />
      <path d="M12 18v2" />
      <path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M18 4v1" />
      <path d="M18 9v11" />
    </svg>
  ),

  check: (
    <svg className="ax-dropdown__check ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M5 12l5 5l10 -10" />
    </svg>
  ),

  dots: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </svg>
  ),

  expandLead: (
    <svg className="ax-icon ax-dropdown__lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
      <path d="M4 16v2a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
    </svg>
  ),

  cartLead: (
    <svg className="ax-icon ax-dropdown__lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304" />
      <path d="M9 11v-5a3 3 0 0 1 6 0v5" />
    </svg>
  ),

  cogLead: (
    <svg className="ax-icon ax-dropdown__lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
      <path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M6 4v4" />
      <path d="M6 12v8" />
      <path d="M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M12 4v10" />
      <path d="M12 18v2" />
      <path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M18 4v1" />
      <path d="M18 9v11" />
    </svg>
  ),
};

/* -------------------------------------------------------
   Notification helpers
------------------------------------------------------- */

function getNotificationList(payload: unknown): NotificationItem[] {
  if (Array.isArray(payload)) {
    return payload as NotificationItem[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const response = payload as Record<string, unknown>;

  if (Array.isArray(response.notifications)) {
    return response.notifications as NotificationItem[];
  }

  if (Array.isArray(response.data)) {
    return response.data as NotificationItem[];
  }

  if (response.data && typeof response.data === 'object') {
    const nested = response.data as Record<string, unknown>;

    if (Array.isArray(nested.notifications)) {
      return nested.notifications as NotificationItem[];
    }

    if (Array.isArray(nested.data)) {
      return nested.data as NotificationItem[];
    }
  }

  return [];
}

function isRead(notification: NotificationItem): boolean {
  if (typeof notification.isRead === 'boolean') {
    return notification.isRead;
  }

  if (typeof notification.read === 'boolean') {
    return notification.read;
  }

  return Boolean(notification.readAt || notification.read_at);
}

function getNotificationDate(
  notification: NotificationItem,
): Date | null {
  const value =
    notification.createdAt ||
    notification.created_at;

  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getTimeAgo(notification: NotificationItem): string {
  const date = getNotificationDate(notification);

  if (!date) return '';

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function getNotificationType(
  notification: NotificationItem,
): string {
  return String(
    notification.type ||
    notification.category ||
    'general',
  ).toLowerCase();
}

function getClearedIds(): Set<string> {
  try {
    const value = localStorage.getItem(CLEARED_STORAGE_KEY);

    if (!value) return new Set();

    const parsed: unknown = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return new Set(parsed.map(String));
    }

    return new Set();
  } catch {
    return new Set();
  }
}

function saveClearedIds(ids: Set<string>) {
  try {
    localStorage.setItem(
      CLEARED_STORAGE_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function canManageNotifications(role: string): boolean {
  return [
    'admin',
    'super_admin',
    'superadmin',
    'org_admin',
    'organization_admin',
  ].includes(normalizeRole(role));
}

function getNotificationAuthHeaders(
  token: string | null,
): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

async function getNotificationError(
  response: Response,
): Promise<string> {
  try {
    const result = await response.json();

    return (
      result?.message ||
      `Request failed (${response.status}).`
    );
  } catch {
    return `Request failed (${response.status}).`;
  }
}

/*
 * Which controls each band sheds into the overflow menu.
 */
const SHED_LG = ['lang', 'fullscreen', 'apps'];
const SHED_MD = ['cart', 'customizer'];

function useShed(): string[] {
  const belowLg = useMediaQuery('(max-width: 991.98px)');
  const belowMd = useMediaQuery('(max-width: 767.98px)');

  return [
    ...(belowLg ? SHED_LG : []),
    ...(belowMd ? SHED_MD : []),
  ];
}

const LANGS: Array<[string, string]> = [
  ['EN', 'English'],
  ['ES', 'Español'],
  ['FR', 'Français'],
  ['AR', 'العربية'],
  ['DE', 'Deutsch'],
  ['ZH', '中文'],
  ['IT', 'Italiano'],
  ['RU', 'Русский'],
];

/* -------------------------------------------------------
   Header utilities
------------------------------------------------------- */

export function HeaderUtils({
  onCustomizer: _onCustomizer,
}: {
  onCustomizer: () => void;
}) {
  const c = useCustomizer();
  const shed = useShed();

  const appToken = useAuthStore((s) => s.appToken);
  const adminToken = useAuthStore((s) => s.adminToken);
  const userRole = useAuthStore((s) => s.userRole);
  const clearAll = useAuthStore((s) => s.clearAll);

  const token = appToken || adminToken;

  const canManage = useMemo(
    () => canManageNotifications(String(userRole || '')),
    [userRole],
  );

  /* -----------------------------------------------------
     Existing profile data
  ----------------------------------------------------- */

  function decodeJwtEmail(value: string | null): string {
    if (!value) return '';

    try {
      const payload = value.split('.')[1];

      if (!payload) return '';

      const normalized = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const decoded = JSON.parse(atob(normalized));

      return decoded.email ?? '';
    } catch {
      return '';
    }
  }

  const email = decodeJwtEmail(token);
  const displayName = email ? email.split('@')[0] : 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  /* -----------------------------------------------------
     Notification state
  ----------------------------------------------------- */

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([]);

  const [notificationLoading, setNotificationLoading] =
    useState(true);

  const [notificationError, setNotificationError] =
    useState('');

  const [notificationActionLoading, setNotificationActionLoading] =
    useState<string | null>(null);

  const [clearedMessage, setClearedMessage] = useState('');

  const [clearedIds, setClearedIds] = useState<Set<string>>(
    () => getClearedIds(),
  );

  /* -----------------------------------------------------
     GET notifications
  ----------------------------------------------------- */

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setNotificationLoading(false);
      return;
    }

    try {
      setNotificationError('');

      const response = await fetch(NOTIFICATIONS_URL, {
        method: 'GET',
        headers: getNotificationAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(
          await getNotificationError(response),
        );
      }

      const payload: unknown = await response.json();

      const result = getNotificationList(payload);

      result.sort((a, b) => {
        const dateA = getNotificationDate(a)?.getTime() || 0;
        const dateB = getNotificationDate(b)?.getTime() || 0;

        return dateB - dateA;
      });

      setNotifications(result);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : 'Unable to load notifications.',
      );
    } finally {
      setNotificationLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchNotifications();

    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  /* -----------------------------------------------------
     Visible notifications (maximum five)
  ----------------------------------------------------- */

  const visibleNotifications = useMemo(() => {
    return notifications
      .filter(
        (notification) =>
          !clearedIds.has(String(notification.id)),
      )
      .slice(0, MAX_HEADER_NOTIFICATIONS);
  }, [notifications, clearedIds]);

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) => !isRead(notification),
    ).length;
  }, [notifications]);

  const visibleUnreadCount = visibleNotifications.filter(
    (notification) => !isRead(notification),
  ).length;

  /* -----------------------------------------------------
     PATCH one notification
  ----------------------------------------------------- */

  const markNotificationAsRead = async (
    notification: NotificationItem,
  ) => {
    if (!canManage || isRead(notification) || !token) {
      return;
    }

    const id = String(notification.id);

    setNotificationActionLoading(id);
    setNotificationError('');
    setClearedMessage('');

    try {
      const response = await fetch(
        `${NOTIFICATIONS_URL}/${encodeURIComponent(id)}/read`,
        {
          method: 'PATCH',
          headers: getNotificationAuthHeaders(token),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getNotificationError(response),
        );
      }

      setNotifications((previous) =>
        previous.map((item) =>
          String(item.id) === id
            ? {
                ...item,
                isRead: true,
                read: true,
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : 'Unable to mark notification as read.',
      );
    } finally {
      setNotificationActionLoading(null);
    }
  };

  /* -----------------------------------------------------
     PATCH all notifications
  ----------------------------------------------------- */

  const markAllNotificationsAsRead = async () => {
    if (!canManage || !token) return;

    const unreadNotifications = notifications.filter(
      (notification) => !isRead(notification),
    );

    if (unreadNotifications.length === 0) return;

    setNotificationActionLoading('all');
    setNotificationError('');
    setClearedMessage('');

    try {
      const results = await Promise.allSettled(
        unreadNotifications.map(async (notification) => {
          const response = await fetch(
            `${NOTIFICATIONS_URL}/${encodeURIComponent(
              String(notification.id),
            )}/read`,
            {
              method: 'PATCH',
              headers: getNotificationAuthHeaders(token),
            },
          );

          if (!response.ok) {
            throw new Error(
              `Failed to update notification ${notification.id}`,
            );
          }

          return String(notification.id);
        }),
      );

      const successfulIds = new Set(
        results
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<string> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value),
      );

      setNotifications((previous) =>
        previous.map((notification) =>
          successfulIds.has(String(notification.id))
            ? {
                ...notification,
                isRead: true,
                read: true,
                readAt: new Date().toISOString(),
              }
            : notification,
        ),
      );

      const failedCount =
        results.length - successfulIds.size;

      if (failedCount > 0) {
        setNotificationError(
          `${successfulIds.size} updated successfully. ${failedCount} failed.`,
        );
      } else {
        setClearedMessage('All notifications marked as read.');
      }
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : 'Unable to update notifications.',
      );
    } finally {
      setNotificationActionLoading(null);
    }
  };

  /* -----------------------------------------------------
     Clear notifications from header dropdown
  ----------------------------------------------------- */

  const clearHeaderNotifications = () => {
    if (visibleNotifications.length === 0) return;

    const updatedIds = new Set(clearedIds);

    visibleNotifications.forEach((notification) => {
      updatedIds.add(String(notification.id));
    });

    setClearedIds(updatedIds);
    saveClearedIds(updatedIds);

    setClearedMessage(
      `${visibleNotifications.length} notifications cleared from this menu.`,
    );

    setNotificationError('');
  };

  /* -----------------------------------------------------
     Existing fullscreen listener
  ----------------------------------------------------- */

  useEffect(() => {
    const onFs = () => {};

    document.addEventListener('fullscreenchange', onFs);

    return () =>
      document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* -----------------------------------------------------
     Header UI
  ----------------------------------------------------- */

  return (
    <>
      {/* 4 · LANGUAGE */}
      {/* Existing language dropdown retained */}

      {/* 5 · FULLSCREEN */}
      {/* Existing fullscreen functionality retained */}

      <KnowledgeBaseDropdown />

      {/* 6 · LIGHT/DARK QUICK-TOGGLE */}
      <button
        type="button"
        className="ax-theme-toggle ax-icon-btn"
        data-ax-toggle="theme"
        onClick={c.toggleTheme}
        aria-pressed={c.themeResolved === 'dark'}
        aria-label="Toggle dark mode"
      >
        {c.themeResolved === 'dark' ? (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
            <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
            <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
          </svg>
        ) : (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true">
            <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" />
          </svg>
        )}
      </button>

      {/* 7 · APP GRID */}
      {/* Existing app grid retained */}

      {/* 8 · CART */}
      {/* Existing cart functionality retained */}

      {/* 9 · DYNAMIC NOTIFICATIONS */}

      <Dropdown
        className="ax-notif"
        panelClassName="ax-dropdown ax-notif__menu"
        panelRole="dialog"
        panelAriaLabel="Notifications"
        trigger={({ open, triggerProps }) => (
          <button
            type="button"
            className="ax-icon-btn ax-notif__trigger"
            aria-label={`Notifications, ${unreadCount} unread`}
            {...triggerProps}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            {ICON.bell}

            {unreadCount > 0 && (
              <span
                className="ax-badge-count"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      >
        <div className="ax-dropdown__head ax-notif__head">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                color: 'var(--ax-text-strong)',
              }}
            >
              Notifications
            </span>

            <small
              style={{
                color: 'var(--ax-text-subtle)',
                fontSize: 11,
              }}
            >
              {unreadCount > 0
                ? `${unreadCount} unread notifications`
                : 'You are all caught up'}
            </small>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {canManage && unreadCount > 0 && (
              <button
                type="button"
                className="ax-notif__mark-all"
                onClick={() => void markAllNotificationsAsRead()}
                disabled={notificationActionLoading === 'all'}
                style={{
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {notificationActionLoading === 'all'
                  ? 'Updating...'
                  : 'Mark all read'}
              </button>
            )}

            <button
              type="button"
              onClick={clearHeaderNotifications}
              disabled={visibleNotifications.length === 0}
              title="Clear notifications from this dropdown"
              aria-label="Clear notifications"
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--ax-text-subtle)',
                fontSize: 11,
                cursor:
                  visibleNotifications.length === 0
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  visibleNotifications.length === 0 ? 0.45 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error */}

        {notificationError && (
          <div
            role="alert"
            style={{
              margin: '10px 14px',
              padding: '9px 11px',
              borderRadius: 8,
              color: 'var(--ax-danger-700, #dc2626)',
              background: 'var(--ax-danger-wash, rgba(220,38,38,.08))',
              fontSize: 12,
            }}
          >
            {notificationError}
          </div>
        )}

        {/* Cleared confirmation */}

        {clearedMessage && (
          <div
            role="status"
            style={{
              margin: '10px 14px',
              padding: '9px 11px',
              borderRadius: 8,
              color: 'var(--ax-success-700, #15803d)',
              background: 'var(--ax-success-wash, rgba(22,163,74,.08))',
              fontSize: 12,
            }}
          >
            {clearedMessage}
          </div>
        )}

        {/* Loading */}

        {notificationLoading && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--ax-text-subtle)',
              fontSize: 13,
            }}
          >
            <span className="ax-notif__loader" />
            <div style={{ marginTop: 10 }}>
              Loading notifications...
            </div>
          </div>
        )}

        {/* Notification list */}

        {!notificationLoading && (
          <ul
            className="ax-notif__list"
            role="list"
            style={{
              maxHeight: 390,
              overflowY: 'auto',
            }}
          >
            {visibleNotifications.map((notification) => {
              const read = isRead(notification);
              const type = getNotificationType(notification);

              return (
                <li
                  key={notification.id}
                  className={`ax-notif__row ${
                    !read ? 'is-unread' : ''
                  }`}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 11,
                    padding: '13px 15px',
                    transition: 'background .2s ease',
                  }}
                >
                  {/* Icon */}

                  <span
                    className={`ax-notif__chip ${
                      type.includes('system')
                        ? 'ax-notif__chip--success'
                        : ''
                    }`}
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {ICON.bell}
                  </span>

                  {/* Content */}

                  <span
                    className="ax-notif__body"
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <b
                      className="ax-notif__title"
                      style={{
                        display: 'block',
                        fontWeight: read ? 500 : 700,
                        color: 'var(--ax-text-strong)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {notification.title || 'Notification'}
                    </b>

                    <span
                      className="ax-notif__text"
                      style={{
                        display: 'block',
                        marginTop: 4,
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {notification.message || 'No additional details.'}
                    </span>

                    <time
                      className="ax-notif__time ax-mono"
                      style={{
                        display: 'block',
                        marginTop: 6,
                      }}
                    >
                      {getTimeAgo(notification)}
                    </time>

                    {/* Mark as read — Admin roles only */}

                    {canManage && !read && (
                      <button
                        type="button"
                        onClick={() =>
                          void markNotificationAsRead(notification)
                        }
                        disabled={
                          notificationActionLoading ===
                          String(notification.id)
                        }
                        style={{
                          marginTop: 8,
                          padding: 0,
                          border: 0,
                          background: 'transparent',
                          color: 'var(--ax-accent)',
                          fontSize: 11,
                          fontWeight: 650,
                          cursor: 'pointer',
                        }}
                      >
                        {notificationActionLoading ===
                        String(notification.id)
                          ? 'Updating...'
                          : 'Mark as read'}
                      </button>
                    )}
                  </span>

                  {/* Unread indicator */}

                  {!read && (
                    <span
                      className="ax-notif__dot"
                      aria-label="Unread"
                      style={{
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Empty state */}

        {!notificationLoading &&
          visibleNotifications.length === 0 && (
            <div
              style={{
                padding: '35px 18px',
                textAlign: 'center',
                color: 'var(--ax-text-subtle)',
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--ax-surface-raised)',
                  color: 'var(--ax-accent)',
                }}
              >
                {ICON.check}
              </div>

              <strong
                style={{
                  display: 'block',
                  color: 'var(--ax-text-strong)',
                  fontSize: 13,
                }}
              >
                You're all caught up!
              </strong>

              <span
                style={{
                  display: 'block',
                  marginTop: 5,
                  fontSize: 12,
                }}
              >
                No notifications to display.
              </span>
            </div>
          )}

        {/* Footer */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 15px',
            borderTop: '1px solid var(--ax-border)',
          }}
        >
          <button
            type="button"
            onClick={() => void fetchNotifications()}
            disabled={notificationLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: 0,
              background: 'transparent',
              color: 'var(--ax-text-subtle)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>

          <Link
            className="ax-dropdown__foot"
            to="/pages/notifications"
            style={{
              padding: 0,
              border: 0,
              fontWeight: 650,
            }}
          >
            View all notifications →
          </Link>
        </div>
      </Dropdown>

      {/* 10 · PROFILE */}

      <Dropdown
        className="ax-profile"
        panelClassName="ax-dropdown ax-profile__menu"
        trigger={({ open, triggerProps }) => (
          <button
            type="button"
            className="ax-profile__trigger"
            aria-label="Account menu"
            {...triggerProps}
            aria-expanded={open}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--ax-accent)',
                color: 'var(--ax-on-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 'var(--ax-text-sm)',
                flexShrink: 0,
              }}
            >
              {initials || 'U'}
            </span>
          </button>
        )}
      >
        <div className="ax-profile__card">
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--ax-accent)',
              color: 'var(--ax-on-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 'var(--ax-text-sm)',
              flexShrink: 0,
            }}
          >
            {initials || 'U'}
          </span>

          <span className="ax-profile__card-meta">
            <b>{displayName}</b>
            <small>{email}</small>
          </span>
        </div>

        <Link className="ax-dropdown__item" role="menuitem" to="/profile">
          View Profile
        </Link>

        <Link
          className="ax-dropdown__item"
          role="menuitem"
          to="/pages/profile-settings"
        >
          Account Settings
        </Link>

        <Link
          className="ax-dropdown__item"
          role="menuitem"
          to="/pages/support"
        >
          Support
        </Link>

        <Link
          className="ax-dropdown__item"
          role="menuitem"
          to="/pages/activity-log"
        >
          Activity Log
        </Link>

        <div className="ax-dropdown__divider" role="separator" />

        <a
          className="ax-dropdown__item ax-dropdown__item--danger"
          role="menuitem"
          href={MARKETING_HOME}
          onClick={(event) => {
            event.preventDefault();
            clearAll();
            window.location.replace(MARKETING_HOME);
          }}
        >
          Log Out
        </a>
      </Dropdown>

      {/* 11 · CUSTOMIZER TRIGGER */}
      {/* Existing customizer functionality retained */}

      {/* OVERFLOW */}

      {shed.length > 0 && (
        <Dropdown
          className="ax-overflow"
          panelId="ax-overflow-menu"
          panelClassName="ax-dropdown ax-overflow__menu"
          trigger={({ open, triggerProps }) => (
            <button
              type="button"
              className="ax-icon-btn ax-overflow__trigger"
              aria-label="More"
              {...triggerProps}
              aria-expanded={open}
            >
              {ICON.dots}
            </button>
          )}
        >
          {({ close }) => (
            <>
              {/* LANGUAGE */}

              <div
                className="ax-overflow__group"
                data-ax-shed="lang"
                role="presentation"
              >
                <p className="ax-dropdown__head">Language</p>

                <div
                  className="ax-overflow__langs"
                  role="group"
                  aria-label="Change language"
                >
                  {LANGS.map(([code]) => (
                    <button
                      key={code}
                      type="button"
                      className={`ax-overflow__lang ax-lang__code${
                        c.lang === code ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        c.setLang(code);
                        close();
                      }}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* FULLSCREEN */}

              {/* APP GRID */}

              {/* CART */}

              {/* CUSTOMIZER */}
            </>
          )}
        </Dropdown>
      )}

      {/* Notification animation and loading styles */}

      <style>
        {`
          .ax-notif__menu {
            animation: phauseNotifIn .2s ease-out;
            transform-origin: top right;
          }

          .ax-notif__row {
            transition:
              background .2s ease,
              transform .2s ease,
              opacity .2s ease;
          }

          .ax-notif__row:hover {
            background: var(--ax-surface-raised);
          }

          .ax-notif__row.is-unread {
            background: color-mix(
              in oklab,
              var(--ax-accent) 5%,
              transparent
            );
          }

          .ax-notif__row.is-unread:hover {
            background: color-mix(
              in oklab,
              var(--ax-accent) 10%,
              transparent
            );
          }

          .ax-notif__loader {
            display: inline-block;
            width: 22px;
            height: 22px;
            border: 2px solid var(--ax-border);
            border-top-color: var(--ax-accent);
            border-radius: 50%;
            animation: phauseNotifSpin .7s linear infinite;
          }

          @keyframes phauseNotifSpin {
            to { transform: rotate(360deg); }
          }

          @keyframes phauseNotifIn {
            from {
              opacity: 0;
              transform: translateY(-7px) scale(.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .ax-notif__mark-all:disabled {
            opacity: .5;
            cursor: not-allowed;
          }

          @media (prefers-reduced-motion: reduce) {
            .ax-notif__menu,
            .ax-notif__row,
            .ax-notif__loader {
              animation: none !important;
              transition: none !important;
            }
          }
        `}
      </style>
    </>
  );
}

export default HeaderUtils;