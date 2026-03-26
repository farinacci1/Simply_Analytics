import { useState, useEffect } from 'react';

const DEVICE_MODES = {
  DESKTOP: 'desktop',
  TABLET: 'tablet',
  MOBILE: 'mobile',
};

/**
 * Auto-detects device mode based on available dashboard canvas width.
 */
export function useDeviceDetection(canvasRef) {
  const [devicePreview, setDevicePreview] = useState(DEVICE_MODES.DESKTOP);
  const [autoDetectDevice, setAutoDetectDevice] = useState(true);

  useEffect(() => {
    if (!autoDetectDevice) return;

    const detectDevice = () => {
      let availableWidth;
      if (canvasRef.current) {
        availableWidth = canvasRef.current.offsetWidth;
      } else {
        availableWidth = window.innerWidth - 220;
      }

      if (availableWidth <= 500) setDevicePreview(DEVICE_MODES.MOBILE);
      else if (availableWidth <= 900) setDevicePreview(DEVICE_MODES.TABLET);
      else setDevicePreview(DEVICE_MODES.DESKTOP);
    };

    detectDevice();

    let resizeObserver;
    if (canvasRef.current) {
      resizeObserver = new ResizeObserver(detectDevice);
      resizeObserver.observe(canvasRef.current);
    }
    window.addEventListener('resize', detectDevice);

    return () => {
      window.removeEventListener('resize', detectDevice);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [autoDetectDevice, canvasRef]);

  const handleDeviceChange = (mode) => {
    setAutoDetectDevice(false);
    setDevicePreview(mode);
  };

  return { devicePreview, handleDeviceChange, DEVICE_MODES };
}
