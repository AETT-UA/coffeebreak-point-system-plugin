import PropTypes from "prop-types";

export default function ModeSelector({ onChooseManual, onChooseActivity }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button type="button" className="btn btn-primary h-14" onClick={onChooseManual}>
        Add manual points
      </button>
      <button type="button" className="btn btn-secondary h-14" onClick={onChooseActivity}>
        Add activity participation points
      </button>
    </div>
  );
}

ModeSelector.propTypes = {
  onChooseManual: PropTypes.func.isRequired,
  onChooseActivity: PropTypes.func.isRequired,
};
