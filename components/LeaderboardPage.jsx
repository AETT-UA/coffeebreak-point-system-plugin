import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { getApi } from "coffeebreak/event-app";
import { HiRefresh, HiStar } from "react-icons/hi";
import { FaMedal, FaTrophy } from "react-icons/fa";

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

function getCurrentUserId() {
  try {
    const keycloak = globalThis.__coffeebreak_keycloak;
    const token = keycloak?.tokenParsed;
    return token?.preferred_username || token?.sub || null;
  } catch (err) {
    console.error('[LeaderboardPage] Error getting current user ID:', err);
    return null;
  }
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

function getRankIcon(rank) {
  if (rank === 1) {
    return (
      <div className="flex items-center gap-2">
        <FaTrophy className="text-yellow-500 text-lg" title="1st Place" />
        <span className="badge badge-warning text-warning-content">#{rank}</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center gap-2">
        <FaMedal className="text-gray-400 text-lg" title="2nd Place" />
        <span className="badge badge-neutral">#{rank}</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center gap-2">
        <FaMedal className="text-amber-700 text-lg" title="3rd Place" />
        <span className="badge badge-accent">#{rank}</span>
      </div>
    );
  }
  return <span className="badge badge-ghost">#{rank}</span>;
}

function getRankBadgeClass(rank, isCurrentUser) {
  if (isCurrentUser) return "badge-primary";
  if (rank === 1) return "badge-warning text-warning-content";
  if (rank === 2) return "badge-neutral";
  if (rank === 3) return "badge-accent";
  return "badge-ghost";
}

function getRowStyle(rank, isCurrentUser) {
  if (isCurrentUser) return {};
  if (rank === 1) return { backgroundImage: 'linear-gradient(to right, rgb(254 240 138), rgb(254 243 199))' };
  if (rank === 2) return { backgroundImage: 'linear-gradient(to right, rgb(229 231 235), rgb(248 250 252))' };
  if (rank === 3) return { backgroundImage: 'linear-gradient(to right, rgb(254 215 170), rgb(254 243 199))' };
  return {};
}

function getRowClass(rank, isCurrentUser) {
  if (isCurrentUser) return "bg-primary/10 font-semibold";
  return "";
}

function getMobileCardStyle(rank, isCurrentUser) {
  if (isCurrentUser) return {};
  if (rank === 1) return { backgroundImage: 'linear-gradient(to bottom right, rgb(254 240 138), rgb(254 243 199))' };
  if (rank === 2) return { backgroundImage: 'linear-gradient(to bottom right, rgb(229 231 235), rgb(248 250 252))' };
  if (rank === 3) return { backgroundImage: 'linear-gradient(to bottom right, rgb(254 215 170), rgb(254 243 199))' };
  return {};
}

function getMobileCardClass(rank, isCurrentUser) {
  if (isCurrentUser) return "border-primary bg-primary/10";
  if (rank === 1) return "border-warning";
  if (rank === 2) return "border-neutral";
  if (rank === 3) return "border-accent";
  return "border-base-300 bg-base-100";
}

export default function LeaderboardPage({
  title = "Event Leaderboard",
  activity_id = null,
  limit = 10,
  show_rank = true,
  refresh_seconds = 30,
  items_per_page = 10,
}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentUserId, setCurrentUserId] = useState(null);

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

  const normalizedItemsPerPage = useMemo(() => {
    const parsed = Number(items_per_page);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }
    return Math.floor(parsed);
  }, [items_per_page]);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);

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
            username: item?.username || null,
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

  // Pagination calculations
  const totalPages = Math.ceil(rows.length / normalizedItemsPerPage);
  const startIndex = (currentPage - 1) * normalizedItemsPerPage;
  const endIndex = startIndex + normalizedItemsPerPage;
  const paginatedRows = rows.slice(startIndex, endIndex);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page) => {
    setCurrentPage(page);
  };

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
            className="btn btn-outline btn-sm btn-square"
            onClick={() => {
              void loadLeaderboard({ silent: true });
            }}
            disabled={isLoading || isRefreshing}
            title={isRefreshing ? "Refreshing..." : "Refresh"}
          >
            <HiRefresh className={`text-lg ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="text-xs text-base-content/60">
          Last updated: {formatLastUpdated(lastUpdatedAt)}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {/* Skeleton loading for desktop */}
            <div className="hidden md:block space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border border-base-300 rounded-lg animate-pulse">
                  <div className="w-12 h-8 bg-base-300 rounded"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-base-300 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-base-300 rounded w-1/4"></div>
                  </div>
                  <div className="h-6 bg-base-300 rounded w-16"></div>
                </div>
              ))}
            </div>
            {/* Skeleton loading for mobile */}
            <div className="md:hidden space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 border border-base-300 rounded-lg animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-5 bg-base-300 rounded w-2/5"></div>
                    <div className="w-12 h-6 bg-base-300 rounded"></div>
                  </div>
                  <div className="h-4 bg-base-300 rounded w-1/4"></div>
                </div>
              ))}
            </div>
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
                  {paginatedRows.map((entry) => {
                    const isCurrentUser = currentUserId && entry.username && entry.username === currentUserId;
                    return (
                      <tr 
                        key={`${entry.user_id}-${entry.rank}`}
                        className={getRowClass(entry.rank, isCurrentUser)}
                        style={getRowStyle(entry.rank, isCurrentUser)}
                      >
                        {show_rank && (
                          <td>
                            <div className="flex items-center">
                              {getRankIcon(entry.rank)}
                            </div>
                          </td>
                        )}
                        <td>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className={`font-medium ${entry.rank <= 3 ? "text-lg" : ""}`}>
                                {entry.user_name}
                                {isCurrentUser && <span className="ml-2 text-xs text-primary">(You)</span>}
                              </div>
                              {entry.user_name !== entry.user_id && (
                                <div className="text-xs text-base-content/60">{entry.user_id}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`text-right font-semibold ${entry.rank <= 3 ? "text-lg" : ""}`}>{entry.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden grid grid-cols-1 gap-2">
              {paginatedRows.map((entry) => {
                const isCurrentUser = currentUserId && entry.username && entry.username === currentUserId;
                return (
                  <div
                    key={`${entry.user_id}-${entry.rank}`}
                    className={`rounded-lg border p-3 ${getMobileCardClass(entry.rank, isCurrentUser)}`}
                    style={getMobileCardStyle(entry.rank, isCurrentUser)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className={`font-medium break-all ${entry.rank <= 3 ? "text-lg" : ""}`}>
                          {entry.user_name}
                          {isCurrentUser && <span className="ml-2 text-xs text-primary">(You)</span>}
                        </div>
                        {entry.user_name !== entry.user_id && (
                          <div className="text-xs text-base-content/60 break-all">{entry.user_id}</div>
                        )}
                      </div>
                      {show_rank && (
                        <div className="flex items-center justify-center min-w-fit">
                          {getRankIcon(entry.rank)}
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-base-content/70">
                      Points: <span className={`font-semibold text-base-content ${entry.rank <= 3 ? "text-base" : ""}`}>{entry.points}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-base-300">
                <div className="text-sm text-base-content/70">
                  Page {currentPage} of {totalPages} ({rows.length} total)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    ← Prev
                  </button>
                  
                  {/* Page numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`btn btn-sm ${currentPage === pageNum ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => handlePageClick(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
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
  items_per_page: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
