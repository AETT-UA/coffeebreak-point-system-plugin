import PropTypes from "prop-types";

export default function ManualAwardForm({
  scannedUserId,
  pointsInput,
  descriptionInput,
  isSubmitting,
  onSubmit,
  onPointsChange,
  onDescriptionChange,
  onRescan,
  onChangeMode,
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="alert alert-info text-sm">
        Participant identified: <span className="font-semibold">{scannedUserId}</span>
      </div>

      <label className="form-control w-full">
        <span className="label-text mb-1">Points to award</span>
        <input
          type="number"
          min="1"
          step="1"
          className="input input-bordered w-full"
          value={pointsInput}
          onChange={(event) => onPointsChange(event.target.value)}
          placeholder="e.g. 10"
          required
        />
      </label>

      <label className="form-control w-full">
        <span className="label-text mb-1">Description (required)</span>
        <textarea
          className="textarea textarea-bordered h-24 w-full"
          value={descriptionInput}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Why these points were awarded"
          required
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Award points"}
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

ManualAwardForm.propTypes = {
  scannedUserId: PropTypes.string.isRequired,
  pointsInput: PropTypes.string.isRequired,
  descriptionInput: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onPointsChange: PropTypes.func.isRequired,
  onDescriptionChange: PropTypes.func.isRequired,
  onRescan: PropTypes.func.isRequired,
  onChangeMode: PropTypes.func.isRequired,
};
