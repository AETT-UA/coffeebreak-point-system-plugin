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

export default function TemplateQrClaimPage({
  title = "Claim Points",
  success_timeout_ms = 1500,
}) {
  const successTimeoutMs = Number(success_timeout_ms) > 0 ? Number(success_timeout_ms) : 1500;

  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanInProgressRef = useRef(false);
  const claimInProgressRef = useRef(false);
  const lastScannedRef = useRef({ value: "", at: 0 });
  const resumeTimeoutRef = useRef(null);

  const supportsBarcodeDetector =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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

  const startScanner = useCallback(async () => {
    if (scanIntervalRef.current || streamRef.current || claimInProgressRef.current) {
      return;
    }

    if (!supportsBarcodeDetector) {
      setError("This browser does not support live QR scanning.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Camera API is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        setError("Camera preview is not available.");
        stopScanner();
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanIntervalRef.current = window.setInterval(() => {
        void (async () => {
          if (
            !detectorRef.current ||
            !videoRef.current ||
            scanInProgressRef.current ||
            claimInProgressRef.current
          ) {
            return;
          }

          if (videoRef.current.readyState < 2) {
            return;
          }

          scanInProgressRef.current = true;
          try {
            const detections = await detectorRef.current.detect(videoRef.current);
            if (!Array.isArray(detections) || detections.length === 0) {
              return;
            }

            const firstQr = detections.find(
              (item) => typeof item?.rawValue === "string" && item.rawValue.trim()
            );
            if (!firstQr) {
              return;
            }

            const token = firstQr.rawValue.trim();
            const now = Date.now();

            if (
              lastScannedRef.current.value === token &&
              now - lastScannedRef.current.at < DUPLICATE_SCAN_COOLDOWN_MS
            ) {
              return;
            }

            lastScannedRef.current = { value: token, at: now };

            claimInProgressRef.current = true;
            setIsClaiming(true);
            setError(null);
            setSuccessMessage("");

            try {
              const api = getApi();
              const response = await api.post(
                "/coffeebreak-point-system-plugin/transaction-template/claim",
                { token }
              );

              const awardedPoints = Number(response?.data?.points ?? 0);
              setSuccessMessage(
                awardedPoints > 0
                  ? `Claim successful: +${awardedPoints} points`
                  : "Claim successful"
              );

              stopScanner();

              if (resumeTimeoutRef.current) {
                window.clearTimeout(resumeTimeoutRef.current);
              }
              resumeTimeoutRef.current = window.setTimeout(() => {
                setSuccessMessage("");
                void startScanner();
              }, successTimeoutMs);
            } catch (claimError) {
              setError(getErrorMessage(claimError, "Failed to claim points."));
            } finally {
              setIsClaiming(false);
              claimInProgressRef.current = false;
            }
          } catch (scanError) {
            setError(getErrorMessage(scanError, "Unable to read QR code."));
          } finally {
            scanInProgressRef.current = false;
          }
        })();
      }, SCAN_INTERVAL_MS);

      setIsScannerActive(true);
    } catch (cameraError) {
      stopScanner();
      setError(getErrorMessage(cameraError, "Could not start camera. Check permissions."));
    }
  }, [stopScanner, successTimeoutMs, supportsBarcodeDetector]);

  useEffect(() => {
    void startScanner();
    return () => {
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <section className="card bg-base-100 border border-base-300 shadow-md">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="text-sm text-base-content/70">Scan the template QR to claim points.</p>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-200/50 p-3">
          <video
            ref={videoRef}
            className="w-full rounded-lg border border-base-300 bg-black/90"
            playsInline
            muted
            autoPlay
          />
        </div>

        {isClaiming ? <div className="alert alert-info text-sm">Claiming points...</div> : null}
        {successMessage ? <div className="alert alert-success text-sm">{successMessage}</div> : null}
        {error ? <div className="alert alert-error text-sm">{error}</div> : null}

        {!supportsBarcodeDetector ? (
          <div className="alert alert-warning text-sm">
            Your browser does not support camera QR scanning.
          </div>
        ) : null}

        <div className="text-xs text-base-content/60">
          Scanner status: {isScannerActive ? "active" : "initializing"}
        </div>
      </div>
    </section>
  );
}

TemplateQrClaimPage.propTypes = {
  title: PropTypes.string,
  success_timeout_ms: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
