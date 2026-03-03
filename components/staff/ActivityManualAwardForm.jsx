import PropTypes from "prop-types";

export default function ActivityManualAwardForm({
  scannedUserId,
  selectedActivity,
  activityPointsInput,
  isSubmitting,
  onSubmit,
  onPointsChange,
  onRescan,
  onChangeMode,
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="alert alert-info text-sm">
        Participant identified: <span className="font-semibold">{scannedUserId}</span>
      </div>

      {selectedActivity ? (
        <div className="alert alert-info text-sm">
          Activity: <span className="font-semibold">{selectedActivity.name}</span>
        </div>
      ) : null}

      <label className="form-control w-full">
        <span className="label-text mb-1">Points to award for this activity</span>
        <input
          type="number"
          min="1"
          step="1"
          className="input input-bordered w-full text-base"
          value={activityPointsInput}
          onChange={(event) => onPointsChange(event.target.value)}
          placeholder="e.g. 10"
          required
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Award activity points"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRescan}>
          Rescan participant
        </button>
        <button type="button" className="btn btn-outline" onClick={onChangeMode}>
          Change mode
        </button>
      </div>
    </form>
  );
}

ActivityManualAwardForm.propTypes = {
  scannedUserId: PropTypes.string.isRequired,
  selectedActivity: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    points: PropTypes.number.isRequired,
    pointsMode: PropTypes.string.isRequired,
    templateName: PropTypes.string,
  }),
  activityPointsInput: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onPointsChange: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired,
  onChangeMode: PropTypes.func.isRequired,
};
