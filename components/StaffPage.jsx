import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { getApi } from "coffeebreak/event-app";

const SCAN_INTERVAL_MS = 450;
const DUPLICATE_SCAN_COOLDOWN_MS = 2500;

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
  const [step, setStep] = useState("scan");
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [scannedUserId, setScannedUserId] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [manualQrInput, setManualQrInput] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanInProgressRef = useRef(false);
  const verifyInProgressRef = useRef(false);
  const lastScannedRef = useRef({ value: "", at: 0 });

  const isBrowser = typeof window !== "undefined";
  const supportsBarcodeDetector = isBrowser && "BarcodeDetector" in window;

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

  const verifyQrPayload = useCallback(async (payload) => {
    const otp = payload.trim();
    if (!otp || verifyInProgressRef.current) {
      return;
    }

    verifyInProgressRef.current = true;
    setIsVerifying(true);
    setScannerError(null);

    try {
      const api = getApi();
      const response = await api.post("/totp/verify-totp", { otp });
      const userId = response?.data?.user_id;

      if (!userId) {
        throw new Error("QR code verification did not return a user id.");
      }

      setScannedUserId(String(userId));
      setPointsInput("");
      setDescriptionInput("");
      setSuccessMessage("");
      setSubmitError(null);
      setStep("award");
      stopScanner();
    } catch (error) {
      setScannerError(getErrorMessage(error, "Invalid or expired QR code."));
    } finally {
      setIsVerifying(false);
      verifyInProgressRef.current = false;
    }
  }, [stopScanner]);

  const scanFrame = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || scanInProgressRef.current || verifyInProgressRef.current) {
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

      const firstQr = detections.find((item) => typeof item?.rawValue === "string" && item.rawValue.trim());
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
      if (step === "scan") {
        setScannerError(getErrorMessage(error, "Unable to read the QR code from camera."));
      }
    } finally {
      scanInProgressRef.current = false;
    }
  }, [step, verifyQrPayload]);

  const startScanner = useCallback(async () => {
    if (isScannerActive) {
      return;
    }

    setScannerError(null);
    setSubmitError(null);
    setSuccessMessage("");

    if (!supportsBarcodeDetector) {
      setScannerError("This browser does not support live QR scanning. Use manual QR input below.");
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
      setScannerError(getErrorMessage(error, "Could not start camera. Check browser permissions."));
    }
  }, [isScannerActive, scanFrame, stopScanner, supportsBarcodeDetector]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleManualVerify = useCallback(async () => {
    await verifyQrPayload(manualQrInput);
  }, [manualQrInput, verifyQrPayload]);

  const handleSubmitPoints = useCallback(async (event) => {
    event.preventDefault();

    const parsedPoints = Number(pointsInput);
    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      setSubmitError("Points must be a number greater than zero.");
      return;
    }

    if (!scannedUserId) {
      setSubmitError("Missing scanned user id.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const api = getApi();
      await api.post(
        `/coffeebreak-point-system-plugin/point-system/points/${encodeURIComponent(scannedUserId)}/add`,
        {
          activity_id: null,
          points: parsedPoints,
          description: descriptionInput.trim() || null,
        },
        {
          params: {
            transaction_type: "manual",
          },
        }
      );

      setSuccessMessage(`Successfully awarded ${parsedPoints} points to ${scannedUserId}.`);
      setStep("success");
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Failed to award points."));
    } finally {
      setIsSubmitting(false);
    }
  }, [descriptionInput, pointsInput, scannedUserId]);

  const handleScanAnother = useCallback(() => {
    setStep("scan");
    setScannedUserId("");
    setPointsInput("");
    setDescriptionInput("");
    setManualQrInput("");
    setSuccessMessage("");
    setSubmitError(null);
    setScannerError(null);
    verifyInProgressRef.current = false;
    scanInProgressRef.current = false;
  }, []);

  const handleAwardMoreToSameUser = useCallback(() => {
    setPointsInput("");
    setDescriptionInput("");
    setSubmitError(null);
    setSuccessMessage("");
    setStep("award");
  }, []);

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <div>
          <h1 className="card-title">{title}</h1>
          <p className="text-sm text-base-content/70">
            Scan a participant QR code and award points manually.
          </p>
        </div>

        {step === "scan" && (
          <>
            <div className="rounded-xl border border-base-300 bg-base-200/50 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {!isScannerActive ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      void startScanner();
                    }}
                    disabled={isVerifying}
                  >
                    Start camera scanner
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={stopScanner}
                    disabled={isVerifying}
                  >
                    Stop scanner
                  </button>
                )}
                {isVerifying && <span className="text-sm">Verifying QR code...</span>}
              </div>

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
              <label className="mb-2 block text-sm font-medium">
                Manual QR payload (fallback)
              </label>
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
                disabled={isVerifying || !manualQrInput.trim()}
              >
                Verify QR manually
              </button>
            </div>

            {scannerError && <div className="alert alert-error text-sm">{scannerError}</div>}
          </>
        )}

        {step === "award" && (
          <form className="space-y-3" onSubmit={handleSubmitPoints}>
            <div className="alert alert-info text-sm">
              Participant identified: <span className="font-semibold">{scannedUserId}</span>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1">Points to award</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="input input-bordered w-full"
                value={pointsInput}
                onChange={(event) => setPointsInput(event.target.value)}
                placeholder="e.g. 10"
                required
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">Description (optional)</span>
              <textarea
                className="textarea textarea-bordered h-24 w-full"
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                placeholder="Why these points were awarded"
              />
            </label>

            {submitError && <div className="alert alert-error text-sm">{submitError}</div>}

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Award points"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleScanAnother}>
                Scan another user
              </button>
            </div>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-3">
            <div className="alert alert-success">{successMessage}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={handleAwardMoreToSameUser}>
                Award more to same user
              </button>
              <button type="button" className="btn btn-outline" onClick={handleScanAnother}>
                Scan another user
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

StaffPage.propTypes = {
  title: PropTypes.string,
};
