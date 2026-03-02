import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { getApi, useActivity } from "coffeebreak/event-app";

const SCAN_INTERVAL_MS = 450;
const DUPLICATE_SCAN_COOLDOWN_MS = 2500;

const STEP_CHOOSE_MODE = "choose_mode";
const STEP_MANUAL_SCAN = "manual_scan";
const STEP_MANUAL_AWARD = "manual_award";
const STEP_ACTIVITY_SELECT = "activity_select";
const STEP_ACTIVITY_SCAN = "activity_scan";
const STEP_SUCCESS = "success";

const MODE_MANUAL = "manual";
const MODE_ACTIVITY = "activity";

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

export default function StaffPage({ title = "Staff QR Scanner" }) {
  const { activities = [], loading: activitiesLoading, error: activitiesError } = useActivity();

  const [step, setStep] = useState(STEP_CHOOSE_MODE);
  const [mode, setMode] = useState(null);

  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [scannerError, setScannerError] = useState(null);
  const [flowError, setFlowError] = useState(null);

  const [scannedUserId, setScannedUserId] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [manualQrInput, setManualQrInput] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [templatesByActivity, setTemplatesByActivity] = useState({});
  const [duplicateActivityIds, setDuplicateActivityIds] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanInProgressRef = useRef(false);
  const verifyInProgressRef = useRef(false);
  const lastScannedRef = useRef({ value: "", at: 0 });

  const isBrowser = typeof window !== "undefined";
  const supportsBarcodeDetector = isBrowser && "BarcodeDetector" in window;

  const activityOptions = useMemo(() => {
    const options = [];
    for (const activity of activities) {
      const activityId = Number(activity.id);
      if (!Number.isInteger(activityId)) {
        continue;
      }

      const templates = templatesByActivity[activityId];
      if (!Array.isArray(templates) || templates.length !== 1) {
        continue;
      }

      const template = templates[0];
      const label =
        typeof activity?.name === "string" && activity.name.trim() ? activity.name.trim() : null;

      if (!label) {
        continue;
      }

      options.push({
        id: activityId,
        name: label,
        points: Number(template.points ?? 0),
        templateName: template.name,
      });
    }

    options.sort((left, right) => left.name.localeCompare(right.name));
    return options;
  }, [activities, templatesByActivity]);

  const selectedActivity = useMemo(() => {
    return activityOptions.find((activity) => String(activity.id) === selectedActivityId) || null;
  }, [activityOptions, selectedActivityId]);

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    scanInProgressRef.current = false;
    setIsScannerActive(false);
  }, []);

  const resetTransientState = useCallback(() => {
    setScannerError(null);
    setFlowError(null);
    setManualQrInput("");
    setSuccessMessage("");
    setScannedUserId("");
    verifyInProgressRef.current = false;
    scanInProgressRef.current = false;
    lastScannedRef.current = { value: "", at: 0 };
  }, []);

  const chooseManualMode = useCallback(() => {
    stopScanner();
    resetTransientState();
    setMode(MODE_MANUAL);
    setPointsInput("");
    setDescriptionInput("");
    setStep(STEP_MANUAL_SCAN);
  }, [resetTransientState, stopScanner]);

  const chooseActivityMode = useCallback(() => {
    stopScanner();
    resetTransientState();
    setMode(MODE_ACTIVITY);
    setSelectedActivityId("");
    setPointsInput("");
    setDescriptionInput("");
    setStep(STEP_ACTIVITY_SELECT);
  }, [resetTransientState, stopScanner]);

  const backToModeChooser = useCallback(() => {
    stopScanner();
    resetTransientState();
    setMode(null);
    setPointsInput("");
    setDescriptionInput("");
    setSelectedActivityId("");
    setStep(STEP_CHOOSE_MODE);
  }, [resetTransientState, stopScanner]);

  const resetForNextParticipant = useCallback(() => {
    stopScanner();
    resetTransientState();
    setPointsInput("");
    setDescriptionInput("");

    if (mode === MODE_ACTIVITY) {
      setStep(STEP_ACTIVITY_SCAN);
      return;
    }

    setStep(STEP_MANUAL_SCAN);
  }, [mode, resetTransientState, stopScanner]);

  const submitActivityAward = useCallback(
    async (userId) => {
      const activityId = Number(selectedActivityId);
      if (!Number.isInteger(activityId)) {
        setFlowError("Select an activity before scanning a QR code.");
        return;
      }

      setFlowError(null);
      setIsSubmitting(true);

      try {
        const api = getApi();
        const response = await api.post(
          `/coffeebreak-point-system-plugin/point-system/points/${encodeURIComponent(userId)}/add-activity/${activityId}`,
        );

        const awardedPoints = Number(response?.data?.awarded_points ?? selectedActivity?.points ?? 0);
        const activityName = selectedActivity?.name || `Activity ${activityId}`;

        setSuccessMessage(
          `Successfully awarded ${awardedPoints} points for ${activityName}.`,
        );
        setStep(STEP_SUCCESS);
      } catch (error) {
        setFlowError(getErrorMessage(error, "Failed to add activity points."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedActivity, selectedActivityId],
  );

  const onVerifiedUser = useCallback(
    async (userId) => {
      setScannedUserId(userId);

      if (mode === MODE_MANUAL) {
        setPointsInput("");
        setDescriptionInput("");
        setFlowError(null);
        setStep(STEP_MANUAL_AWARD);
        return;
      }

      if (mode === MODE_ACTIVITY) {
        await submitActivityAward(userId);
      }
    },
    [mode, submitActivityAward],
  );

  const verifyQrPayload = useCallback(
    async (payload) => {
      const otp = payload.trim();
      if (!otp || verifyInProgressRef.current) {
        return;
      }

      verifyInProgressRef.current = true;
      setIsVerifying(true);
      setScannerError(null);
      setFlowError(null);

      try {
        const api = getApi();
        const response = await api.post("/totp/verify-totp", { otp });
        const userId = response?.data?.user_id;

        if (!userId) {
          throw new Error("QR code verification did not return a user id.");
        }

        stopScanner();
        await onVerifiedUser(String(userId));
      } catch (error) {
        setScannerError(getErrorMessage(error, "Invalid or expired QR code."));
      } finally {
        setIsVerifying(false);
        verifyInProgressRef.current = false;
      }
    },
    [onVerifiedUser, stopScanner],
  );

  const scanFrame = useCallback(async () => {
    if (
      !detectorRef.current ||
      !videoRef.current ||
      scanInProgressRef.current ||
      verifyInProgressRef.current
    ) {
      return;
    }

    const videoElement = videoRef.current;
    if (videoElement.readyState < 2) {
      return;
    }

    scanInProgressRef.current = true;

    try {
      const detections = await detectorRef.current.detect(videoElement);
      if (!Array.isArray(detections) || detections.length === 0) {
        return;
      }

      const firstQr = detections.find(
        (item) => typeof item?.rawValue === "string" && item.rawValue.trim(),
      );
      if (!firstQr) {
        return;
      }

      const rawValue = firstQr.rawValue.trim();
      const now = Date.now();

      if (
        lastScannedRef.current.value === rawValue &&
        now - lastScannedRef.current.at < DUPLICATE_SCAN_COOLDOWN_MS
      ) {
        return;
      }

      lastScannedRef.current = { value: rawValue, at: now };
      await verifyQrPayload(rawValue);
    } catch (error) {
      setScannerError(getErrorMessage(error, "Unable to read the QR code from camera."));
    } finally {
      scanInProgressRef.current = false;
    }
  }, [verifyQrPayload]);

  const startScanner = useCallback(async () => {
    if (isScannerActive) {
      return;
    }

    const isScanStep = step === STEP_MANUAL_SCAN || step === STEP_ACTIVITY_SCAN;
    if (!isScanStep) {
      return;
    }

    if (mode === MODE_ACTIVITY && !selectedActivity) {
      setFlowError("Select an activity before starting the scanner.");
      return;
    }

    setScannerError(null);
    setFlowError(null);

    if (!supportsBarcodeDetector) {
      setScannerError(
        "This browser does not support live QR scanning. Use manual QR input below.",
      );
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScannerError("Camera API is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        setScannerError("Camera preview is not available.");
        stopScanner();
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });

      scanIntervalRef.current = window.setInterval(() => {
        void scanFrame();
      }, SCAN_INTERVAL_MS);

      setIsScannerActive(true);
    } catch (error) {
      stopScanner();
      setScannerError(
        getErrorMessage(error, "Could not start camera. Check browser permissions."),
      );
    }
  }, [
    isScannerActive,
    mode,
    scanFrame,
    selectedActivity,
    step,
    stopScanner,
    supportsBarcodeDetector,
  ]);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      setTemplatesError(null);

      try {
        const api = getApi();
        const response = await api.get("/coffeebreak-point-system-plugin/transaction-template");
        const templates = Array.isArray(response.data) ? response.data : [];

        const grouped = {};
        for (const template of templates) {
          const activityId = Number(template?.activity_id);
          if (!Number.isInteger(activityId)) {
            continue;
          }

          if (!grouped[activityId]) {
            grouped[activityId] = [];
          }
          grouped[activityId].push(template);
        }

        setTemplatesByActivity(grouped);
        setDuplicateActivityIds(
          Object.entries(grouped)
            .filter(([, list]) => Array.isArray(list) && list.length > 1)
            .map(([activityId]) => Number(activityId)),
        );
      } catch (error) {
        setTemplatesError(getErrorMessage(error, "Failed to load activity point templates."));
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleManualVerify = useCallback(async () => {
    await verifyQrPayload(manualQrInput);
  }, [manualQrInput, verifyQrPayload]);

  const handleManualSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const parsedPoints = Number(pointsInput);
      if (!Number.isInteger(parsedPoints) || parsedPoints <= 0) {
        setFlowError("Points must be an integer greater than zero.");
        return;
      }

      const description = descriptionInput.trim();
      if (!description) {
        setFlowError("Description is required for manual point attribution.");
        return;
      }

      if (!scannedUserId) {
        setFlowError("Missing scanned user id.");
        return;
      }

      setFlowError(null);
      setIsSubmitting(true);

      try {
        const api = getApi();
        await api.post(
          `/coffeebreak-point-system-plugin/point-system/points/${encodeURIComponent(scannedUserId)}/add`,
          {
            activity_id: null,
            points: parsedPoints,
            description,
          },
          {
            params: {
              transaction_type: "manual",
            },
          },
        );

        setSuccessMessage(`Successfully awarded ${parsedPoints} points.`);
        setStep(STEP_SUCCESS);
      } catch (error) {
        setFlowError(getErrorMessage(error, "Failed to award manual points."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [descriptionInput, pointsInput, scannedUserId],
  );

  const continueToActivityScan = useCallback(() => {
    if (!selectedActivity) {
      setFlowError("Select an activity before scanning.");
      return;
    }

    resetTransientState();
    setStep(STEP_ACTIVITY_SCAN);
  }, [resetTransientState, selectedActivity]);

  const scannerTitle =
    step === STEP_ACTIVITY_SCAN
      ? "Scan participant QR code for activity attribution"
      : "Scan participant QR code for manual attribution";

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <div>
          <h1 className="card-title">{title}</h1>
          <p className="text-sm text-base-content/70">
            Choose the attribution mode, then follow the guided flow.
          </p>
        </div>

        {step === STEP_CHOOSE_MODE && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button type="button" className="btn btn-primary h-14" onClick={chooseManualMode}>
              Add manual points
            </button>
            <button type="button" className="btn btn-secondary h-14" onClick={chooseActivityMode}>
              Add activity participation points
            </button>
          </div>
        )}

        {step === STEP_ACTIVITY_SELECT && (
          <div className="space-y-3">
            <div className="rounded-xl border border-base-300 bg-base-100 p-3">
              <label className="form-control w-full">
                <span className="label-text mb-1">Select activity</span>
                <select
                  className="select select-bordered w-full"
                  value={selectedActivityId}
                  onChange={(event) => setSelectedActivityId(event.target.value)}
                  disabled={isLoadingTemplates || activitiesLoading}
                >
                  <option value="">Choose an activity</option>
                  {activityOptions.map((activity) => (
                    <option key={activity.id} value={String(activity.id)}>
                      {activity.name} - {activity.points} points
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedActivity && (
              <div className="alert alert-info text-sm">
                <span>
                  Selected {selectedActivity.name}. Participants will receive {selectedActivity.points} points automatically.
                </span>
              </div>
            )}

            {duplicateActivityIds.length > 0 && (
              <div className="alert alert-warning text-sm">
                <span>
                  Some activities have multiple templates configured and are hidden from selection.
                </span>
              </div>
            )}

            {templatesError && <div className="alert alert-error text-sm">{templatesError}</div>}
            {activitiesError && <div className="alert alert-error text-sm">{activitiesError}</div>}

            {!isLoadingTemplates && !activitiesLoading && activityOptions.length === 0 && !templatesError && (
              <div className="alert alert-warning text-sm">
                <span>
                  No activity point templates are configured yet. Create one template per activity first.
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={continueToActivityScan}
                disabled={!selectedActivity || isLoadingTemplates || activitiesLoading}
              >
                Continue to QR scan
              </button>
              <button type="button" className="btn btn-ghost" onClick={backToModeChooser}>
                Back
              </button>
            </div>
          </div>
        )}

        {(step === STEP_MANUAL_SCAN || step === STEP_ACTIVITY_SCAN) && (
          <>
            {step === STEP_ACTIVITY_SCAN && selectedActivity && (
              <div className="alert alert-info text-sm">
                <span>
                  Activity: <span className="font-semibold">{selectedActivity.name}</span> - {selectedActivity.points} points
                </span>
              </div>
            )}

            <div className="rounded-xl border border-base-300 bg-base-200/50 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {!isScannerActive ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      void startScanner();
                    }}
                    disabled={isVerifying || isSubmitting}
                  >
                    Start camera scanner
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={stopScanner}
                    disabled={isVerifying || isSubmitting}
                  >
                    Stop scanner
                  </button>
                )}
                {(isVerifying || isSubmitting) && (
                  <span className="text-sm">
                    {isVerifying ? "Verifying QR code..." : "Submitting points..."}
                  </span>
                )}
              </div>

              <p className="text-sm text-base-content/70 mb-2">{scannerTitle}</p>

              <video
                ref={videoRef}
                className="w-full rounded-lg border border-base-300 bg-black/90"
                playsInline
                muted
                autoPlay
              />

              {!supportsBarcodeDetector && (
                <p className="mt-2 text-sm text-warning">
                  Live scanning is not available in this browser.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-base-300 bg-base-100 p-3">
              <label className="mb-2 block text-sm font-medium">Manual QR payload (fallback)</label>
              <textarea
                className="textarea textarea-bordered h-24 w-full"
                value={manualQrInput}
                onChange={(event) => setManualQrInput(event.target.value)}
                placeholder="Paste the full QR text and verify"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-2"
                onClick={() => {
                  void handleManualVerify();
                }}
                disabled={isVerifying || isSubmitting || !manualQrInput.trim()}
              >
                Verify QR manually
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={backToModeChooser}>
                Back
              </button>
            </div>
          </>
        )}

        {step === STEP_MANUAL_AWARD && (
          <form className="space-y-3" onSubmit={handleManualSubmit}>
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
                onChange={(event) => setPointsInput(event.target.value)}
                placeholder="e.g. 10"
                required
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">Description (required)</span>
              <textarea
                className="textarea textarea-bordered h-24 w-full"
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                placeholder="Why these points were awarded"
                required
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Award points"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setStep(STEP_MANUAL_SCAN);
                  setPointsInput("");
                  setDescriptionInput("");
                  setFlowError(null);
                }}
              >
                Rescan participant
              </button>
              <button type="button" className="btn btn-outline" onClick={backToModeChooser}>
                Change mode
              </button>
            </div>
          </form>
        )}

        {step === STEP_SUCCESS && (
          <div className="space-y-3">
            <div className="alert alert-success">{successMessage}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={resetForNextParticipant}>
                Scan another participant
              </button>
              <button type="button" className="btn btn-outline" onClick={backToModeChooser}>
                Change mode
              </button>
            </div>
          </div>
        )}

        {scannerError && <div className="alert alert-error text-sm">{scannerError}</div>}
        {flowError && <div className="alert alert-error text-sm">{flowError}</div>}
      </div>
    </div>
  );
}

StaffPage.propTypes = {
  title: PropTypes.string,
};
