import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { getApi, useActivity } from "coffeebreak/event-app";
import jsQR from "jsqr";

import ActivityManualAwardForm from "./ActivityManualAwardForm.jsx";
import ActivitySelectionStep from "./ActivitySelectionStep.jsx";
import {
  DUPLICATE_SCAN_COOLDOWN_MS,
  MODE_ACTIVITY,
  MODE_MANUAL,
  SCAN_INTERVAL_MS,
  SUCCESS_AUTO_CONTINUE_MS,
  STEP_ACTIVITY_MANUAL_AWARD,
  STEP_ACTIVITY_SCAN,
  STEP_ACTIVITY_SELECT,
  STEP_CHOOSE_MODE,
  STEP_MANUAL_AWARD,
  STEP_MANUAL_SCAN,
  STEP_SUCCESS,
} from "./constants.js";
import ManualAwardForm from "./ManualAwardForm.jsx";
import ModeSelector from "./ModeSelector.jsx";
import ScannerStep from "./ScannerStep.jsx";
import SuccessStep from "./SuccessStep.jsx";
import { getErrorMessage } from "./utils.js";

const CAMERA_CONSTRAINTS = [
  { video: { facingMode: { ideal: "environment" } }, audio: false },
  { video: { facingMode: "environment" }, audio: false },
  { video: true, audio: false },
];

function getCameraErrorMessage(error) {
  const errorName = error?.name;

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "Camera permission denied. Allow camera access in Safari settings and use HTTPS.";
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return "No camera device found.";
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "Camera is already in use by another app.";
  }

  if (errorName === "OverconstrainedError") {
    return "Selected camera is not available. Try another camera.";
  }

  return getErrorMessage(error, "Could not start camera. Check browser permissions and HTTPS.");
}

function buildNoZoomViewportContent(originalContent) {
  const segments = String(originalContent || "")
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter(
      (segment) =>
        !segment.startsWith("initial-scale") &&
        !segment.startsWith("minimum-scale") &&
        !segment.startsWith("maximum-scale") &&
        !segment.startsWith("user-scalable")
    );

  if (!segments.some((segment) => segment.startsWith("width="))) {
    segments.unshift("width=device-width");
  }

  return [...segments, "initial-scale=1", "maximum-scale=1", "user-scalable=no"].join(", ");
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
  const [activityPointsInput, setActivityPointsInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [templatesByActivity, setTemplatesByActivity] = useState({});
  const [duplicateActivityIds, setDuplicateActivityIds] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanInProgressRef = useRef(false);
  const verifyInProgressRef = useRef(false);
  const lastScannedRef = useRef({ value: "", at: 0 });

  const isBrowser = typeof window !== "undefined";
  const supportsBarcodeDetector = isBrowser && "BarcodeDetector" in window;
  const supportsJsQr = typeof jsQR === "function";
  const supportsLiveScanning = supportsBarcodeDetector || supportsJsQr;

  const requestCameraStream = useCallback(async () => {
    let lastError = null;

    for (const constraints of CAMERA_CONSTRAINTS) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        const errorName = error?.name;

        if (errorName === "NotAllowedError" || errorName === "SecurityError") {
          break;
        }
      }
    }

    throw lastError || new Error("Could not access camera.");
  }, []);

  const detectQrToken = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement || videoElement.readyState < 2) {
      return null;
    }

    if (detectorRef.current) {
      const detections = await detectorRef.current.detect(videoElement);
      if (!Array.isArray(detections) || detections.length === 0) {
        return null;
      }

      const firstQr = detections.find(
        (item) => typeof item?.rawValue === "string" && item.rawValue.trim()
      );
      return firstQr?.rawValue?.trim() || null;
    }

    if (!supportsJsQr) {
      return null;
    }

    const frameWidth = videoElement.videoWidth;
    const frameHeight = videoElement.videoHeight;
    if (!frameWidth || !frameHeight) {
      return null;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    const canvas = canvasRef.current;
    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
      canvas.width = frameWidth;
      canvas.height = frameHeight;
    }

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(videoElement, 0, 0, frameWidth, frameHeight);
    const imageData = context.getImageData(0, 0, frameWidth, frameHeight);
    const qrResult = jsQR(imageData.data, frameWidth, frameHeight, {
      inversionAttempts: "attemptBoth",
    });

    return typeof qrResult?.data === "string" && qrResult.data.trim()
      ? qrResult.data.trim()
      : null;
  }, [supportsJsQr]);

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

      const pointsMode =
        typeof template.points_mode === "string" && template.points_mode.trim()
          ? template.points_mode.trim().toLowerCase()
          : "automatic";

      if (!["automatic", "manual"].includes(pointsMode)) {
        continue;
      }

      options.push({
        id: activityId,
        name: label,
        points: Number(template.points ?? 0),
        pointsMode,
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
    canvasRef.current = null;
    scanInProgressRef.current = false;
    setIsScannerActive(false);
  }, []);

  const resetTransientState = useCallback(() => {
    setScannerError(null);
    setFlowError(null);
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
    setActivityPointsInput("");
    setDescriptionInput("");
    setStep(STEP_MANUAL_SCAN);
  }, [resetTransientState, stopScanner]);

  const chooseActivityMode = useCallback(() => {
    stopScanner();
    resetTransientState();
    setMode(MODE_ACTIVITY);
    setSelectedActivityId("");
    setPointsInput("");
    setActivityPointsInput("");
    setDescriptionInput("");
    setStep(STEP_ACTIVITY_SELECT);
  }, [resetTransientState, stopScanner]);

  const backToModeChooser = useCallback(() => {
    stopScanner();
    resetTransientState();
    setMode(null);
    setPointsInput("");
    setActivityPointsInput("");
    setDescriptionInput("");
    setSelectedActivityId("");
    setStep(STEP_CHOOSE_MODE);
  }, [resetTransientState, stopScanner]);

  const resetForNextParticipant = useCallback(() => {
    stopScanner();
    resetTransientState();
    setPointsInput("");
    setActivityPointsInput("");
    setDescriptionInput("");

    if (mode === MODE_ACTIVITY) {
      setStep(STEP_ACTIVITY_SCAN);
      return;
    }

    setStep(STEP_MANUAL_SCAN);
  }, [mode, resetTransientState, stopScanner]);

  const submitActivityAward = useCallback(
    async (userId, manualPoints = null) => {
      const activityId = Number(selectedActivityId);
      if (!Number.isInteger(activityId) || !selectedActivity) {
        setFlowError("Select an activity before scanning a QR code.");
        return;
      }

      const pointsMode = selectedActivity.pointsMode === "manual" ? "manual" : "automatic";
      let requestBody = {};

      if (pointsMode === "manual") {
        if (!Number.isInteger(manualPoints) || manualPoints <= 0) {
          setFlowError("Points must be an integer greater than zero.");
          return;
        }
        requestBody = { points: manualPoints };
      }

      setFlowError(null);
      setIsSubmitting(true);

      try {
        const api = getApi();
        const response = await api.post(
          `/coffeebreak-point-system-plugin/point-system/points/${encodeURIComponent(userId)}/add-activity/${activityId}`,
          requestBody
        );

        const awardedPoints = Number(response?.data?.awarded_points ?? selectedActivity.points ?? 0);
        const activityName = selectedActivity.name || `Activity ${activityId}`;

        setSuccessMessage(`Successfully awarded ${awardedPoints} points for ${activityName}.`);
        setStep(STEP_SUCCESS);
      } catch (error) {
        setFlowError(getErrorMessage(error, "Failed to add activity points."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedActivity, selectedActivityId]
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
        if (selectedActivity?.pointsMode === "manual") {
          setActivityPointsInput("");
          setFlowError(null);
          setStep(STEP_ACTIVITY_MANUAL_AWARD);
          return;
        }

        await submitActivityAward(userId);
      }
    },
    [mode, selectedActivity, submitActivityAward]
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
    [onVerifiedUser, stopScanner]
  );

  const scanFrame = useCallback(async () => {
    if (
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
      const rawValue = await detectQrToken();
      if (!rawValue) {
        return;
      }

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
  }, [detectQrToken, verifyQrPayload]);

  const startScanner = useCallback(async () => {
    const isScanStep = step === STEP_MANUAL_SCAN || step === STEP_ACTIVITY_SCAN;
    if (!isScanStep) {
      return;
    }

    if (scanIntervalRef.current || streamRef.current) {
      return;
    }

    if (mode === MODE_ACTIVITY && !selectedActivity) {
      setFlowError("Select an activity before starting the scanner.");
      return;
    }

    setScannerError(null);
    setFlowError(null);

    if (!supportsLiveScanning) {
      setScannerError("This browser does not support live QR scanning.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScannerError("Camera API is not available in this browser.");
      return;
    }

    try {
      const stream = await requestCameraStream();

      streamRef.current = stream;

      if (!videoRef.current) {
        setScannerError("Camera preview is not available.");
        stopScanner();
        return;
      }

      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      await videoRef.current.play();

      if (supportsBarcodeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          detectorRef.current = null;
        }
      } else {
        detectorRef.current = null;
      }

      scanIntervalRef.current = window.setInterval(() => {
        void scanFrame();
      }, SCAN_INTERVAL_MS);

      setIsScannerActive(true);
    } catch (error) {
      stopScanner();
      setScannerError(getCameraErrorMessage(error));
    }
  }, [
    mode,
    requestCameraStream,
    scanFrame,
    selectedActivity,
    step,
    stopScanner,
    supportsBarcodeDetector,
    supportsLiveScanning,
  ]);

  useEffect(() => {
    const isScanStep = step === STEP_MANUAL_SCAN || step === STEP_ACTIVITY_SCAN;
    if (!isScanStep) {
      stopScanner();
      return;
    }

    void startScanner();
  }, [startScanner, step, stopScanner]);

  useEffect(() => {
    if (!isBrowser) {
      return undefined;
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      return undefined;
    }

    const originalViewportContent = viewportMeta.getAttribute("content") || "width=device-width, initial-scale=1";
    viewportMeta.setAttribute("content", buildNoZoomViewportContent(originalViewportContent));

    let lastTouchEnd = 0;

    const preventGestureZoom = (event) => {
      event.preventDefault();
    };

    const preventMultiTouchZoom = (event) => {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const preventDoubleTapZoom = (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener("gesturestart", preventGestureZoom);
    document.addEventListener("gesturechange", preventGestureZoom);
    document.addEventListener("gestureend", preventGestureZoom);
    document.addEventListener("touchmove", preventMultiTouchZoom, { passive: false });
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("gestureend", preventGestureZoom);
      document.removeEventListener("touchmove", preventMultiTouchZoom);
      document.removeEventListener("touchend", preventDoubleTapZoom);
      viewportMeta.setAttribute("content", originalViewportContent);
    };
  }, [isBrowser]);

  useEffect(() => {
    if (step !== STEP_SUCCESS) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      resetForNextParticipant();
    }, SUCCESS_AUTO_CONTINUE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [resetForNextParticipant, step]);

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
            .map(([activityId]) => Number(activityId))
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
          }
        );

        setSuccessMessage(`Successfully awarded ${parsedPoints} points.`);
        setStep(STEP_SUCCESS);
      } catch (error) {
        setFlowError(getErrorMessage(error, "Failed to award manual points."));
      } finally {
        setIsSubmitting(false);
      }
    },
    [descriptionInput, pointsInput, scannedUserId]
  );

  const handleActivityManualSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!scannedUserId) {
        setFlowError("Missing scanned user id.");
        return;
      }

      const parsedPoints = Number(activityPointsInput);
      if (!Number.isInteger(parsedPoints) || parsedPoints <= 0) {
        setFlowError("Points must be an integer greater than zero.");
        return;
      }

      await submitActivityAward(scannedUserId, parsedPoints);
    },
    [activityPointsInput, scannedUserId, submitActivityAward]
  );

  const continueToActivityScan = useCallback(() => {
    if (!selectedActivity) {
      setFlowError("Select an activity before scanning.");
      return;
    }

    resetTransientState();
    setStep(STEP_ACTIVITY_SCAN);
  }, [resetTransientState, selectedActivity]);

  const handleScanBack = useCallback(() => {
    stopScanner();
    resetTransientState();

    if (mode === MODE_ACTIVITY) {
      setStep(STEP_ACTIVITY_SELECT);
      return;
    }

    setStep(STEP_CHOOSE_MODE);
    setMode(null);
  }, [mode, resetTransientState, stopScanner]);

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <div>
          <h1 className="card-title">{title}</h1>
          <p className="text-sm text-base-content/70">Choose the attribution mode, then follow the guided flow.</p>
        </div>

        {step === STEP_CHOOSE_MODE ? (
          <ModeSelector onChooseManual={chooseManualMode} onChooseActivity={chooseActivityMode} />
        ) : null}

        {step === STEP_ACTIVITY_SELECT ? (
          <ActivitySelectionStep
            selectedActivityId={selectedActivityId}
            activityOptions={activityOptions}
            isLoadingTemplates={isLoadingTemplates}
            activitiesLoading={activitiesLoading}
            selectedActivity={selectedActivity}
            duplicateActivityIds={duplicateActivityIds}
            templatesError={templatesError}
            activitiesError={activitiesError}
            onChangeActivity={setSelectedActivityId}
            onContinue={continueToActivityScan}
            onBack={backToModeChooser}
          />
        ) : null}

        {step === STEP_MANUAL_SCAN || step === STEP_ACTIVITY_SCAN ? (
          <ScannerStep
            selectedActivity={step === STEP_ACTIVITY_SCAN ? selectedActivity : null}
            isScannerActive={isScannerActive}
            isVerifying={isVerifying}
            isSubmitting={isSubmitting}
            supportsLiveScanning={supportsLiveScanning}
            videoRef={videoRef}
            onStopScanner={stopScanner}
            onBack={handleScanBack}
          />
        ) : null}

        {step === STEP_MANUAL_AWARD ? (
          <ManualAwardForm
            scannedUserId={scannedUserId}
            pointsInput={pointsInput}
            descriptionInput={descriptionInput}
            isSubmitting={isSubmitting}
            onSubmit={handleManualSubmit}
            onPointsChange={setPointsInput}
            onDescriptionChange={setDescriptionInput}
            onRescan={() => {
              setStep(STEP_MANUAL_SCAN);
              setPointsInput("");
              setDescriptionInput("");
              setFlowError(null);
            }}
            onChangeMode={backToModeChooser}
          />
        ) : null}

        {step === STEP_ACTIVITY_MANUAL_AWARD ? (
          <ActivityManualAwardForm
            scannedUserId={scannedUserId}
            selectedActivity={selectedActivity}
            activityPointsInput={activityPointsInput}
            isSubmitting={isSubmitting}
            onSubmit={handleActivityManualSubmit}
            onPointsChange={setActivityPointsInput}
            onRescan={() => {
              setStep(STEP_ACTIVITY_SCAN);
              setActivityPointsInput("");
              setFlowError(null);
            }}
            onChangeMode={backToModeChooser}
          />
        ) : null}

        {step === STEP_SUCCESS ? (
          <SuccessStep successMessage={successMessage} />
        ) : null}

        {scannerError ? <div className="alert alert-error text-sm">{scannerError}</div> : null}
        {flowError ? <div className="alert alert-error text-sm">{flowError}</div> : null}
      </div>
    </div>
  );
}

StaffPage.propTypes = {
  title: PropTypes.string,
};
