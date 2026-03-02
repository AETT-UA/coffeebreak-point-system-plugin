import PropTypes from "prop-types";

export default function ScannerStep({
  selectedActivity,
  isScannerActive,
  isVerifying,
  isSubmitting,
  supportsBarcodeDetector,
  videoRef,
  onStopScanner,
  onBack,
}) {
  return (
    <>
      {selectedActivity ? (
        <div className="alert alert-info text-sm">
          <span>
            {selectedActivity.pointsMode === "manual" ? (
              <>
                Activity: <span className="font-semibold">{selectedActivity.name}</span> - points entered after scan
              </>
            ) : (
              <>
                Activity: <span className="font-semibold">{selectedActivity.name}</span> - {selectedActivity.points} points
              </>
            )}
          </span>
        </div>
      ) : null}

      <div className="rounded-xl border border-base-300 bg-base-200/50 p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {isScannerActive ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onStopScanner}
              disabled={isVerifying || isSubmitting}
            >
              Stop scanner
            </button>
          ) : null}
          {(isVerifying || isSubmitting) && (
            <span className="text-sm">{isVerifying ? "Verifying QR code..." : "Submitting points..."}</span>
          )}
        </div>

        <video
          ref={videoRef}
          className="w-full rounded-lg border border-base-300 bg-black/90"
          playsInline
          muted
          autoPlay
        />

        {!supportsBarcodeDetector ? (
          <p className="mt-2 text-sm text-warning">
            This browser does not support live QR scanning.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  );
}

ScannerStep.propTypes = {
  selectedActivity: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    points: PropTypes.number.isRequired,
    pointsMode: PropTypes.string.isRequired,
    templateName: PropTypes.string,
  }),
  isScannerActive: PropTypes.bool.isRequired,
  isVerifying: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  supportsBarcodeDetector: PropTypes.bool.isRequired,
  videoRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  onStopScanner: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
