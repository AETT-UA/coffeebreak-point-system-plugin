import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { getApi } from "coffeebreak/event-app";
import { HiRefresh, HiTrendingUp, HiTrendingDown } from "react-icons/hi";

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
    return token?.sub || null;
  } catch (err) {
    console.error('[MyPointsPage] Error getting current user ID:', err);
    return null;
  }
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export default function MyPointsPage({
  title = "My Points",
  show_transactions = true,
  transaction_limit = 10,
}) {
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);

  const loadUserData = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!currentUserId) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const api = getApi();

        // Fetch user points
        const pointsResponse = await api.get(
          `/coffeebreak-point-system-plugin/point-system/points/${encodeURIComponent(currentUserId)}`
        );
        setUserData(pointsResponse.data);

        // Fetch transactions if enabled
        if (show_transactions) {
          try {
            const transactionsResponse = await api.get(
              `/coffeebreak-point-system-plugin/point-system/points/${encodeURIComponent(currentUserId)}/history`,
              {
                params: {
                  limit: transaction_limit,
                },
              }
            );
            setTransactions(Array.isArray(transactionsResponse.data) ? transactionsResponse.data : []);
          } catch (txError) {
            console.warn("Failed to load transactions:", txError);
            setTransactions([]);
          }
        }

        // Fetch leaderboard to find rank
        try {
          const leaderboardResponse = await api.get(
            "/coffeebreak-point-system-plugin/point-system/leaderboard"
          );
          const leaderboard = Array.isArray(leaderboardResponse.data) ? leaderboardResponse.data : [];
          const userRank = leaderboard.findIndex(
            (entry) => String(entry.id) === String(currentUserId)
          );
          setLeaderboardRank(userRank >= 0 ? userRank + 1 : null);
        } catch (rankError) {
          console.warn("Failed to fetch rank:", rankError);
          setLeaderboardRank(null);
        }
      } catch (requestError) {
        setError(
          getErrorMessage(requestError, "Failed to load your points data.")
        );
      } finally {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [currentUserId, show_transactions, transaction_limit]
  );

  useEffect(() => {
    if (currentUserId) {
      void loadUserData();
    }
  }, [currentUserId, loadUserData]);

  if (!currentUserId) {
    return (
      <section className="card bg-base-100 shadow-md border border-base-300">
        <div className="card-body">
          <h2 className="card-title">{title}</h2>
          <div className="alert alert-warning text-sm">
            Please log in to view your points.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-base-100 shadow-md border border-base-300">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title">{title}</h2>
            <p className="text-sm text-base-content/70">
              View your points balance and transaction history
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm btn-square"
            onClick={() => {
              void loadUserData({ silent: true });
            }}
            disabled={isLoading || isRefreshing}
            title={isRefreshing ? "Refreshing..." : "Refresh"}
          >
            <HiRefresh className={`text-lg ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/60 p-4">
            <span className="loading loading-spinner loading-sm"></span>
            <span className="text-sm">Loading your points data...</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="alert alert-error text-sm">{error}</div>
        )}

        {!isLoading && !error && userData && (
          <>
            {/* Points Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Points Card */}
              <div className="stats shadow border border-base-300">
                <div className="stat">
                  <div className="stat-title">Total Points</div>
                  <div className="stat-value text-primary">{userData.points || 0}</div>
                  <div className="stat-desc">Your current balance</div>
                </div>
              </div>

              {/* Rank Card */}
              {leaderboardRank !== null && (
                <div className="stats shadow border border-base-300">
                  <div className="stat">
                    <div className="stat-title">Leaderboard Rank</div>
                    <div className="stat-value text-secondary">#{leaderboardRank}</div>
                    <div className="stat-desc">
                      {leaderboardRank === 1 && "First place!"}
                      {leaderboardRank === 2 && "Second place"}
                      {leaderboardRank === 3 && "Third place"}
                      {leaderboardRank > 3 && `Keep climbing!`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transaction History */}
            {show_transactions && transactions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Recent Transactions</h3>
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th className="text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => {
                        const isCredit = tx.points > 0;
                        return (
                          <tr key={tx.id}>
                            <td className="text-sm">{formatDate(tx.created_at)}</td>
                            <td>
                              <span className={`badge badge-sm ${
                                isCredit 
                                  ? "badge-success" 
                                  : "badge-error"
                              }`}>
                                {tx.transaction_type}
                              </span>
                            </td>
                            <td className="text-sm">{tx.description || "-"}</td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isCredit ? (
                                  <HiTrendingUp className="text-success" />
                                ) : (
                                  <HiTrendingDown className="text-error" />
                                )}
                                <span className={`font-semibold ${
                                  isCredit 
                                    ? "text-success" 
                                    : "text-error"
                                }`}>
                                  {isCredit ? "+" : ""}
                                  {tx.points}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {show_transactions && transactions.length === 0 && (
              <div className="alert alert-info text-sm">
                No transaction history available yet.
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

MyPointsPage.propTypes = {
  title: PropTypes.string,
  show_transactions: PropTypes.bool,
  transaction_limit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
