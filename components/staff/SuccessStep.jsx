import PropTypes from "prop-types";

export default function SuccessStep({ successMessage }) {
  return (
    <div className="space-y-3">
      <div className="alert alert-success">{successMessage}</div>
      <p className="text-sm text-base-content/70">Returning to scanner...</p>
    </div>
  );
}

SuccessStep.propTypes = {
  successMessage: PropTypes.string.isRequired,
};
