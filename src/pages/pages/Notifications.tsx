import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/shell/PageHead';

type Filter = 'all' | 'unread' | 'mentions' | 'system';

interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  createdAt?: string;
  created_at?: string;
  readAt?: string | null;
  read_at?: string | null;
  isRead?: boolean;
  read?: boolean;
  type?: string;
  category?: string;
  source?: string;
  mentions?: unknown[];
  [key: string]: unknown;
}

interface ApiResponse {
  data?: unknown;
  notifications?: unknown;
  message?: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/+$/, '');

const API_PREFIX = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

const NOTIFICATIONS_ENDPOINT = `${API_PREFIX}/notifications`;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'system', label: 'System' },
];

/* -------------------------------------------------------
   Authentication helpers
------------------------------------------------------- */

function getAccessToken(): string | null {
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token')
  );
}

function parseStoredUser(value: string | null): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid stored JSON.
  }

  return null;
}

function getRoleFromObject(
  value: Record<string, unknown> | null,
): string | null {
  if (!value) return null;

  const user = value.user as Record<string, unknown> | undefined;
  const data = value.data as Record<string, unknown> | undefined;

  const role =
    value.role ||
    value.userRole ||
    value.user_role ||
    user?.role ||
    data?.role;

  return typeof role === 'string' ? role : null;
}

function getRoleFromToken(): string | null {
  const token = getAccessToken();

  if (!token) return null;

  try {
    const payload = token.split('.')[1];

    if (!payload) return null;

    const normalized = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decoded = JSON.parse(atob(normalized)) as Record<string, unknown>;

    return (
      getRoleFromObject(decoded) ||
      (typeof decoded.authorities === 'string'
        ? decoded.authorities
        : null)
    );
  } catch {
    return null;
  }
}

function getCurrentUserRole(): string {
  const storedRole =
    localStorage.getItem('user_role') ||
    localStorage.getItem('role');

  if (storedRole) return storedRole;

  const storedUser =
    parseStoredUser(localStorage.getItem('user')) ||
    parseStoredUser(localStorage.getItem('profile')) ||
    parseStoredUser(localStorage.getItem('currentUser')) ||
    parseStoredUser(localStorage.getItem('auth_user'));

  return (
    getRoleFromObject(storedUser) ||
    getRoleFromToken() ||
    ''
  );
}

function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function canManageNotifications(role: string): boolean {
  const normalizedRole = normalizeRole(role);

  return [
    'admin',
    'super_admin',
    'superadmin',
    'org_admin',
    'organization_admin',
  ].includes(normalizedRole);
}

/* -------------------------------------------------------
   API helpers
------------------------------------------------------- */

function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function getApiError(response: Response): Promise<string> {
  try {
    const result = (await response.json()) as ApiResponse;

    return (
      result.message ||
      `Request failed with status ${response.status}.`
    );
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

function extractNotifications(response: unknown): NotificationItem[] {
  if (Array.isArray(response)) {
    return response as NotificationItem[];
  }

  if (!response || typeof response !== 'object') {
    return [];
  }

  const result = response as Record<string, unknown>;

  if (Array.isArray(result.notifications)) {
    return result.notifications as NotificationItem[];
  }

  if (Array.isArray(result.data)) {
    return result.data as NotificationItem[];
  }

  if (result.data && typeof result.data === 'object') {
    const nested = result.data as Record<string, unknown>;

    if (Array.isArray(nested.notifications)) {
      return nested.notifications as NotificationItem[];
    }

    if (Array.isArray(nested.data)) {
      return nested.data as NotificationItem[];
    }
  }

  return [];
}

function isNotificationRead(notification: NotificationItem): boolean {
  if (typeof notification.isRead === 'boolean') {
    return notification.isRead;
  }

  if (typeof notification.read === 'boolean') {
    return notification.read;
  }

  return Boolean(
    notification.readAt ||
    notification.read_at,
  );
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

function isMention(notification: NotificationItem): boolean {
  const type = String(
    notification.type || notification.category || '',
  ).toLowerCase();

  if (type.includes('mention')) return true;

  if (
    Array.isArray(notification.mentions) &&
    notification.mentions.length > 0
  ) {
    return true;
  }

  return false;
}

function isSystemNotification(
  notification: NotificationItem,
): boolean {
  const type = String(
    notification.type ||
    notification.category ||
    notification.source ||
    '',
  ).toLowerCase();

  return type.includes('system');
}

function getNotificationGroup(
  notification: NotificationItem,
): 'Today' | 'Yesterday' | 'Earlier' {
  const date = getNotificationDate(notification);

  if (!date) return 'Earlier';

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const notificationDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (notificationDay.getTime() === today.getTime()) {
    return 'Today';
  }

  if (notificationDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return 'Earlier';
}

function formatNotificationTime(
  notification: NotificationItem,
): string {
  const date = getNotificationDate(notification);

  if (!date) return '';

  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() !== now.getFullYear()
        ? 'numeric'
        : undefined,
  });
}

/* -------------------------------------------------------
   Icons
------------------------------------------------------- */

function NotificationIcon({ type }: { type?: string }) {
  const normalized = (type || '').toLowerCase();

  if (normalized.includes('system')) {
    return (
      <svg
        className="ax-avatar__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
        <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      </svg>
    );
  }

  return (
    <svg
      className="ax-avatar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0 -12 0c0 7 -3 7 -3 9h18c0 -2 -3 -2 -3 -9" />
      <path d="M10 21h4" />
    </svg>
  );
}

/* -------------------------------------------------------
   Main component
------------------------------------------------------- */

export function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');

  const userRole = useMemo(() => getCurrentUserRole(), []);

  const canManage = useMemo(
    () => canManageNotifications(userRole),
    [userRole],
  );

  /* -----------------------------------------------------
     GET notifications
  ----------------------------------------------------- */

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(NOTIFICATIONS_ENDPOINT, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const result: unknown = await response.json();

      const notificationList = extractNotifications(result);

      setNotifications(notificationList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load notifications.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  /* -----------------------------------------------------
     PATCH one notification as read
  ----------------------------------------------------- */

  const markAsRead = async (notification: NotificationItem) => {
    if (!canManage || isNotificationRead(notification)) return;

    setMarkingRead(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `${NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(
          String(notification.id),
        )}/read`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const updatedNotification: NotificationItem = {
        ...notification,
        isRead: true,
        read: true,
        readAt: new Date().toISOString(),
      };

      setNotifications((previous) =>
        previous.map((item) =>
          String(item.id) === String(notification.id)
            ? { ...item, ...updatedNotification }
            : item,
        ),
      );

      setSelectedNotification(updatedNotification);
      setSuccess('Notification marked as read.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark notification as read.',
      );
    } finally {
      setMarkingRead(false);
    }
  };

  /* -----------------------------------------------------
     PATCH all unread notifications
  ----------------------------------------------------- */

  const markAllAsRead = async () => {
    if (!canManage || markingAll) return;

    const unreadNotifications = notifications.filter(
      (notification) => !isNotificationRead(notification),
    );

    if (unreadNotifications.length === 0) return;

    setMarkingAll(true);
    setError('');
    setSuccess('');

    try {
      const results = await Promise.allSettled(
        unreadNotifications.map(async (notification) => {
          const response = await fetch(
            `${NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(
              String(notification.id),
            )}/read`,
            {
              method: 'PATCH',
              headers: getAuthHeaders(),
            },
          );

          if (!response.ok) {
            throw new Error(
              `Failed to update notification ${notification.id}`,
            );
          }

          return notification.id;
        }),
      );

      const successfulIds = new Set(
        results
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<string | number> =>
              result.status === 'fulfilled',
          )
          .map((result) => String(result.value)),
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

      if (
        selectedNotification &&
        successfulIds.has(String(selectedNotification.id))
      ) {
        setSelectedNotification((previous) =>
          previous
            ? {
                ...previous,
                isRead: true,
                read: true,
                readAt: new Date().toISOString(),
              }
            : null,
        );
      }

      const failedCount = results.length - successfulIds.size;

      if (failedCount > 0) {
        setError(
          `${successfulIds.size} notifications marked as read. ${failedCount} could not be updated.`,
        );
      } else {
        setSuccess('All notifications marked as read.');
      }
    } catch {
      setError('Unable to update notifications.');
    } finally {
      setMarkingAll(false);
    }
  };

  /* -----------------------------------------------------
     Filters and counts
  ----------------------------------------------------- */

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !isNotificationRead(notification),
      ).length,
    [notifications],
  );

  const mentionCount = useMemo(
    () => notifications.filter(isMention).length,
    [notifications],
  );

  const systemCount = useMemo(
    () => notifications.filter(isSystemNotification).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filter === 'unread') {
      result = result.filter(
        (notification) => !isNotificationRead(notification),
      );
    }

    if (filter === 'mentions') {
      result = result.filter(isMention);
    }

    if (filter === 'system') {
      result = result.filter(isSystemNotification);
    }

    const searchValue = search.trim().toLowerCase();

    if (searchValue) {
      result = result.filter((notification) => {
        const title = String(notification.title || '').toLowerCase();
        const message = String(notification.message || '').toLowerCase();

        return (
          title.includes(searchValue) ||
          message.includes(searchValue)
        );
      });
    }

    return result.sort((a, b) => {
      const dateA = getNotificationDate(a)?.getTime() || 0;
      const dateB = getNotificationDate(b)?.getTime() || 0;

      return dateB - dateA;
    });
  }, [notifications, filter, search]);

  const groupedNotifications = useMemo(() => {
    const groups: Record<
      'Today' | 'Yesterday' | 'Earlier',
      NotificationItem[]
    > = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredNotifications.forEach((notification) => {
      groups[getNotificationGroup(notification)].push(notification);
    });

    return groups;
  }, [filteredNotifications]);

  const filterCounts: Record<Filter, number> = {
    all: notifications.length,
    unread: unreadCount,
    mentions: mentionCount,
    system: systemCount,
  };

  /* -----------------------------------------------------
     Render notification row
  ----------------------------------------------------- */

  const renderNotification = (notification: NotificationItem) => {
    const isRead = isNotificationRead(notification);

    const type = String(
      notification.type || notification.category || '',
    );

    return (
      <li
        key={notification.id}
        className="ax-list__row"
        style={{
          cursor: 'pointer',
          borderInlineStart: !isRead
            ? '2px solid var(--ax-accent)'
            : '2px solid transparent',
          background: !isRead
            ? 'var(--ax-accent-wash)'
            : 'transparent',
          paddingInlineStart: 'var(--ax-space-3)',
          transition: 'background 180ms ease',
        }}
        onClick={() => {
          setSelectedNotification(notification);
          setError('');
          setSuccess('');
        }}
      >
        <span className="ax-list__leading">
          <span
            className="ax-avatar ax-avatar--sm ax-avatar--squircle"
            style={{
              background:
                'color-mix(in oklab,var(--ax-accent) 14%,transparent)',
              color: 'var(--ax-accent)',
            }}
          >
            <NotificationIcon type={type} />
          </span>
        </span>

        <span className="ax-list__content">
          <span
            className="ax-list__title"
            style={{
              color: 'var(--ax-text-strong)',
              fontWeight: !isRead ? 700 : 500,
            }}
          >
            {notification.title || 'Notification'}
          </span>

          <span className="ax-list__meta">
            {notification.message || 'No additional details available.'}
          </span>

          <span
            className="ax-list__meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 5,
            }}
          >
            {!isRead && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--ax-accent)',
                }}
              />
            )}

            <span>{formatNotificationTime(notification)}</span>

            {type && (
              <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">
                {type}
              </span>
            )}
          </span>
        </span>

        <span
          className="ax-list__trailing"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            className={`ax-badge ax-badge--soft ax-badge--pill ${
              isRead
                ? 'ax-badge--neutral'
                : 'ax-badge--accent'
            }`}
          >
            {isRead ? 'Read' : 'Unread'}
          </span>

          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </li>
    );
  };

  /* -----------------------------------------------------
     Main UI
  ----------------------------------------------------- */

  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Everything that needs your attention, in one place."
        actions={
          <>
            <Link
              className="ax-btn ax-btn--ghost"
              to="/pages/profile-settings"
            >
              <svg
                className="ax-btn__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" />
                <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
              </svg>

              <span className="ax-btn__label">Settings</span>
            </Link>

            {canManage && (
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0 || markingAll}
              >
                {markingAll ? 'Updating...' : 'Mark all as read'}
              </button>
            )}
          </>
        }
      />

      <div className="ax-dash-grid">
        <section
          className="ax-card ax-col--12"
          role="region"
          aria-label="Notifications list"
        >
          <div className="ax-card__header">
            <div
              className="ax-card__titles"
              style={{ flex: '1 1 auto' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  width: '100%',
                }}
              >
                <div>
                  <h3 className="ax-card__title">
                    Your notifications
                  </h3>

                  <p className="ax-card__subtitle">
                    {notifications.length} total notifications ·{' '}
                    {unreadCount} unread
                  </p>
                </div>

                <button
                  type="button"
                  className="ax-btn ax-btn--ghost ax-btn--sm"
                  onClick={() => void fetchNotifications()}
                  disabled={loading}
                >
                  <svg
                    className="ax-btn__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 7v5h-5" />
                    <path d="M4 17v-5h5" />
                    <path d="M5.64 9A7 7 0 0 1 18.36 7L20 12" />
                    <path d="M4 12l1.64 5A7 7 0 0 0 18.36 15" />
                  </svg>

                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div
            className="ax-card__body"
            style={{ paddingTop: 0 }}
            aria-live="polite"
          >
            {/* Success message */}

            {success && (
              <div
                className="ax-alert ax-alert--success"
                style={{ marginBottom: 'var(--ax-space-4)' }}
              >
                <span className="ax-alert__icon">
                  ✓
                </span>

                <div className="ax-alert__content">
                  <p className="ax-alert__message">{success}</p>
                </div>

                <button
                  type="button"
                  className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
                  onClick={() => setSuccess('')}
                  aria-label="Dismiss success message"
                >
                  ×
                </button>
              </div>
            )}

            {/* Error message */}

            {error && (
              <div
                className="ax-alert ax-alert--danger"
                style={{ marginBottom: 'var(--ax-space-4)' }}
              >
                <span className="ax-alert__icon">!</span>

                <div className="ax-alert__content">
                  <p className="ax-alert__message">{error}</p>
                </div>

                <button
                  type="button"
                  className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
                  onClick={() => setError('')}
                  aria-label="Dismiss error message"
                >
                  ×
                </button>
              </div>
            )}

            {/* Search */}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 'var(--ax-space-4)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  flex: '1 1 260px',
                  maxWidth: 420,
                }}
              >
                <input
                  type="search"
                  className="ax-input"
                  placeholder="Search notifications..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search notifications"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Filter tabs */}

            <div className="ax-tabs">
              <div
                className="ax-tabs__list"
                role="tablist"
                aria-label="Filter notifications"
              >
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ax-tabs__tab"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}

                    <span
                      className={`ax-tabs__badge ax-badge ax-badge--soft ${
                        item.id === 'unread'
                          ? 'ax-badge--accent'
                          : 'ax-badge--neutral'
                      } ax-num`}
                    >
                      {filterCounts[item.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}

            {loading && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '64px 16px',
                  color: 'var(--ax-text-subtle)',
                }}
              >
                <span className="ax-spinner" />
                <span>Loading notifications...</span>
              </div>
            )}

            {/* Empty state */}

            {!loading && filteredNotifications.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '64px 16px',
                  textAlign: 'center',
                  color: 'var(--ax-text-subtle)',
                }}
              >
                <svg
                  width={42}
                  height={42}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 8a6 6 0 0 0 -12 0c0 7 -3 7 -3 9h18c0 -2 -3 -2 -3 -9" />
                  <path d="M10 21h4" />
                </svg>

                <strong style={{ color: 'var(--ax-text-strong)' }}>
                  No notifications found
                </strong>

                <span style={{ fontSize: 'var(--ax-text-sm)' }}>
                  {search
                    ? 'Try another search term.'
                    : 'You are all caught up. There are no notifications to display.'}
                </span>
              </div>
            )}

            {/* Notification groups */}

            {!loading &&
              (['Today', 'Yesterday', 'Earlier'] as const).map(
                (group) => {
                  const items = groupedNotifications[group];

                  if (items.length === 0) return null;

                  return (
                    <div key={group}>
                      <div
                        style={{
                          fontSize: 'var(--ax-text-xs)',
                          fontWeight: 'var(--ax-weight-semibold)',
                          textTransform: 'uppercase',
                          letterSpacing: '.05em',
                          color: 'var(--ax-text-subtle)',
                          padding: 'var(--ax-space-3) 0',
                          marginTop: 'var(--ax-space-2)',
                        }}
                      >
                        {group}
                        <span
                          style={{
                            marginLeft: 8,
                            opacity: 0.7,
                          }}
                        >
                          ({items.length})
                        </span>
                      </div>

                      <ul className="ax-list">
                        {items.map(renderNotification)}
                      </ul>
                    </div>
                  );
                },
              )}

            {/* Footer */}

            {!loading && filteredNotifications.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 'var(--ax-space-5) 0 var(--ax-space-2)',
                  color: 'var(--ax-text-subtle)',
                  fontSize: 'var(--ax-text-sm)',
                }}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5l10 -10" />
                </svg>

                You've reached the end of your notifications.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* -------------------------------------------------
          Notification detail modal
      ------------------------------------------------- */}

      {selectedNotification && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedNotification(null);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(7px)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
            className="ax-card"
            style={{
              width: '100%',
              maxWidth: 540,
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
              animation: 'notificationModalIn 180ms ease',
            }}
          >
            <div
              className="ax-card__header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div className="ax-card__titles">
                <h3
                  id="notification-modal-title"
                  className="ax-card__title"
                >
                  Notification details
                </h3>

                <p className="ax-card__subtitle">
                  View notification information and read status.
                </p>
              </div>

              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--icon"
                onClick={() => setSelectedNotification(null)}
                aria-label="Close notification details"
              >
                ×
              </button>
            </div>

            <div className="ax-card__body">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <span
                  className="ax-avatar ax-avatar--squircle"
                  style={{
                    width: 46,
                    height: 46,
                    background:
                      'color-mix(in oklab,var(--ax-accent) 14%,transparent)',
                    color: 'var(--ax-accent)',
                  }}
                >
                  <NotificationIcon
                    type={String(
                      selectedNotification.type ||
                      selectedNotification.category ||
                      '',
                    )}
                  />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 650,
                      color: 'var(--ax-text-strong)',
                    }}
                  >
                    {selectedNotification.title || 'Notification'}
                  </div>

                  <div
                    style={{
                      fontSize: 'var(--ax-text-xs)',
                      color: 'var(--ax-text-subtle)',
                      marginTop: 4,
                    }}
                  >
                    {formatNotificationTime(selectedNotification)}
                  </div>
                </div>

                <span
                  className={`ax-badge ax-badge--soft ax-badge--pill ${
                    isNotificationRead(selectedNotification)
                      ? 'ax-badge--neutral'
                      : 'ax-badge--accent'
                  }`}
                >
                  {isNotificationRead(selectedNotification)
                    ? 'Read'
                    : 'Unread'}
                </span>
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: 'var(--ax-surface-raised)',
                  border: '1px solid var(--ax-border)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--ax-text-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    fontWeight: 650,
                    color: 'var(--ax-text-subtle)',
                    marginBottom: 10,
                  }}
                >
                  Message
                </div>

                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.7,
                    color: 'var(--ax-text)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {selectedNotification.message ||
                    'No additional details available.'}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                  marginTop: 18,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 'var(--ax-text-xs)',
                      color: 'var(--ax-text-subtle)',
                      marginBottom: 5,
                    }}
                  >
                    Notification ID
                  </div>

                  <div
                    style={{
                      fontSize: 'var(--ax-text-sm)',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {selectedNotification.id}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 'var(--ax-text-xs)',
                      color: 'var(--ax-text-subtle)',
                      marginBottom: 5,
                    }}
                  >
                    Category
                  </div>

                  <div style={{ fontSize: 'var(--ax-text-sm)' }}>
                    {String(
                      selectedNotification.type ||
                      selectedNotification.category ||
                      'General',
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div
                  className="ax-alert ax-alert--danger"
                  style={{ marginTop: 18 }}
                >
                  <span className="ax-alert__icon">!</span>
                  <div className="ax-alert__content">
                    <p className="ax-alert__message">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div
                  className="ax-alert ax-alert--success"
                  style={{ marginTop: 18 }}
                >
                  <span className="ax-alert__icon">✓</span>
                  <div className="ax-alert__content">
                    <p className="ax-alert__message">{success}</p>
                  </div>
                </div>
              )}
            </div>

            <div
              className="ax-card__footer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                flexWrap: 'wrap',
                padding: '16px 20px',
                borderTop: '1px solid var(--ax-border)',
              }}
            >
              <button
                type="button"
                className="ax-btn ax-btn--ghost"
                onClick={() => setSelectedNotification(null)}
              >
                Close
              </button>

              {canManage &&
                !isNotificationRead(selectedNotification) && (
                  <button
                    type="button"
                    className="ax-btn ax-btn--primary"
                    onClick={() =>
                      void markAsRead(selectedNotification)
                    }
                    disabled={markingRead}
                  >
                    {markingRead
                      ? 'Updating...'
                      : 'Mark as read'}
                  </button>
                )}
            </div>
          </section>
        </div>
      )}

      <style>
        {`
          @keyframes notificationModalIn {
            from {
              opacity: 0;
              transform: translateY(12px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .ax-list__row {
            transition: background 180ms ease, border-color 180ms ease;
          }

          .ax-list__row:hover {
            background: var(--ax-surface-raised);
          }

          @media (max-width: 600px) {
            .ax-card__footer {
              flex-direction: column-reverse;
              align-items: stretch !important;
            }

            .ax-card__footer .ax-btn {
              width: 100%;
              justify-content: center;
            }
          }
        `}
      </style>
    </>
  );
}

export default Notifications;