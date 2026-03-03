import PropTypes from "prop-types";

export default function ActivitySelectionStep({
  selectedActivityId,
  activityOptions,
  isLoadingTemplates,
  activitiesLoading,
  selectedActivity,
  templatesError,
  activitiesError,
  onChangeActivity,
  onContinue,
  onBack,
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-base-300 bg-base-100 p-3">
        <label className="form-control w-full">
          <span className="label-text mb-1">Select activity</span>
          <select
            className="select select-bordered w-full text-base"
            value={selectedActivityId}
            onChange={(event) => onChangeActivity(event.target.value)}
            disabled={isLoadingTemplates || activitiesLoading}
          >
            <option value="">Choose an activity</option>
            {activityOptions.map((activity) => (
              <option key={`${activity.id}:${activity.templateId}`} value={`${activity.id}:${activity.templateId}`}>
                {activity.name} -
                {activity.pointsMode === "manual"
                  ? " manual points input"
                  : ` ${activity.points} auto points`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedActivity && (
        <div className="alert alert-info text-sm">
          <span>
            {selectedActivity.pointsMode === "manual"
              ? `Selected ${selectedActivity.name}. After scanning, enter points manually and transaction will stay tied to this activity.`
              : `Selected ${selectedActivity.name}. Participants will receive ${selectedActivity.points} points automatically.`}
          </span>
        </div>
      )}

      {templatesError && <div className="alert alert-error text-sm">{templatesError}</div>}
      {activitiesError && <div className="alert alert-error text-sm">{activitiesError}</div>}

      {!isLoadingTemplates &&
      !activitiesLoading &&
      activityOptions.length === 0 &&
      !templatesError ? (
        <div className="alert alert-warning text-sm">
          <span>No activity point templates are configured yet. Create one template per activity first.</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onContinue}
          disabled={!selectedActivity || isLoadingTemplates || activitiesLoading}
        >
          Continue to QR scan
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

ActivitySelectionStep.propTypes = {
  selectedActivityId: PropTypes.string.isRequired,
  activityOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      points: PropTypes.number.isRequired,
      pointsMode: PropTypes.string.isRequired,
      templateName: PropTypes.string,
      templateId: PropTypes.number.isRequired,
    })
  ).isRequired,
  isLoadingTemplates: PropTypes.bool.isRequired,
  activitiesLoading: PropTypes.bool.isRequired,
  selectedActivity: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    points: PropTypes.number.isRequired,
    pointsMode: PropTypes.string.isRequired,
    templateName: PropTypes.string,
    templateId: PropTypes.number,
  }),
  templatesError: PropTypes.string,
  activitiesError: PropTypes.string,
  onChangeActivity: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
