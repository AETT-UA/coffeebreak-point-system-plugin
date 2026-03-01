import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { getApi } from "coffeebreak/event-app";

function getErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) {
    return detail[0].msg;
  }

  return fallbackMessage;
}

function formatLastUpdated(dateValue) {
  if (!dateValue) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(dateValue);
}

export default function LeaderboardPage({
  title = "Event Leaderboard",
  activity_id = null,
  limit = 10,
  show_rank = true,
  refresh_seconds = 30,
}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const endpoint = useMemo(() => {
    const hasActivityId =
      activity_id !== null &&
      activity_id !== undefined &&
      String(activity_id).trim() !== "";

    if (hasActivityId) {
      return `/coffeebreak-point-system-plugin/point-system/leaderboard/${encodeURIComponent(activity_id)}`;
    }

    return "/coffeebreak-point-system-plugin/point-system/leaderboard";
  }, [activity_id]);

  const normalizedLimit = useMemo(() => {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }
    return Math.floor(parsed);
  }, [limit]);

  const normalizedRefreshSeconds = useMemo(() => {
    const parsed = Number(refresh_seconds);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 30;
    }
    return Math.floor(parsed);
  }, [refresh_seconds]);

  const loadLeaderboard = useCallback(
    async ({ silent } = { silent: false }) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const api = getApi();
        const response = await api.get(endpoint);
        const payload = Array.isArray(response.data) ? response.data : [];

        const normalized = payload
          .map((item) => ({
            user_id: String(item?.id ?? item?.user_id ?? "-"),
            user_name:
              typeof item?.name === "string" && item.name.trim()
                ? item.name.trim()
                : String(item?.id ?? item?.user_id ?? "-"),
            points: Number(item?.points ?? 0),
          }))
          .sort((left, right) => right.points - left.points)
          .slice(0, normalizedLimit)
          .map((item, index) => ({
            ...item,
            rank: index + 1,
          }));

        setRows(normalized);
        setLastUpdatedAt(new Date());
      } catch (requestError) {
        setError(
          getErrorMessage(requestError, "Failed to load leaderboard data."),
        );
      } finally {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [endpoint, normalizedLimit],
  );

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (normalizedRefreshSeconds <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void loadLeaderboard({ silent: true });
    }, normalizedRefreshSeconds * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadLeaderboard, normalizedRefreshSeconds]);

  return (
    <section className="card bg-base-100 shadow-md border border-base-300">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title">{title}</h2>
            <p className="text-sm text-base-content/70">
              {activity_id
                ? `Showing activity leaderboard for activity ${activity_id}.`
                : "Showing the global event leaderboard."}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              void loadLeaderboard({ silent: true });
            }}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="text-xs text-base-content/60">
          Last updated: {formatLastUpdated(lastUpdatedAt)}
        </div>

        {isLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/60 p-4">
            <span className="loading loading-spinner loading-sm"></span>
            <span className="text-sm">Loading leaderboard...</span>
          </div>
        )}

        {!isLoading && error && <div className="alert alert-error text-sm">{error}</div>}

        {!isLoading && !error && rows.length === 0 && (
          <div className="alert alert-info text-sm">No leaderboard entries available yet.</div>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    {show_rank && <th>Rank</th>}
                    <th>Participant</th>
                    <th className="text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={`${entry.user_id}-${entry.rank}`}>
                      {show_rank && (
                        <td>
                          <span className="badge badge-ghost">#{entry.rank}</span>
                        </td>
                      )}
                      <td>
                        <div className="font-medium">{entry.user_name}</div>
                        {entry.user_name !== entry.user_id && (
                          <div className="text-xs text-base-content/60">{entry.user_id}</div>
                        )}
                      </td>
                      <td className="text-right font-semibold">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden grid grid-cols-1 gap-2">
              {rows.map((entry) => (
                <div
                  key={`${entry.user_id}-${entry.rank}`}
                  className="rounded-lg border border-base-300 p-3 bg-base-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium break-all">{entry.user_name}</div>
                      {entry.user_name !== entry.user_id && (
                        <div className="text-xs text-base-content/60 break-all">{entry.user_id}</div>
                      )}
                    </div>
                    {show_rank && <span className="badge badge-ghost">#{entry.rank}</span>}
                  </div>
                  <div className="mt-1 text-sm text-base-content/70">
                    Points: <span className="font-semibold text-base-content">{entry.points}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

LeaderboardPage.propTypes = {
  title: PropTypes.string,
  activity_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  limit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  show_rank: PropTypes.bool,
  refresh_seconds: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
