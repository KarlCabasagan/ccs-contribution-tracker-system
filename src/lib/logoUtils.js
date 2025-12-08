/**
 * Logo Base64 Utility
 * Pre-encoded logo for embedding in PDF/Word exports
 * This avoids async loading issues during export
 */

import logoDark from "../assets/contribution-tracker-logo-dark.png";
import logoLight from "../assets/contribution-tracker-logo-light.png";

// Cache for base64 encoded logos
let logoDarkBase64 = null;
let logoLightBase64 = null;

/**
 * Convert image URL to base64 string
 * @param {string} url - Image URL
 * @returns {Promise<string>} Base64 encoded image
 */
async function imageToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

/**
 * Initialize and cache logos as base64
 * Call this on app startup for best performance
 */
export async function initLogos() {
  if (!logoDarkBase64) {
    logoDarkBase64 = await imageToBase64(logoDark);
  }
  if (!logoLightBase64) {
    logoLightBase64 = await imageToBase64(logoLight);
  }
}

/**
 * Get logo as base64 for exports (always light version for documents)
 * @returns {Promise<string>} Base64 encoded logo
 */
export async function getLogoBase64() {
  if (!logoLightBase64) {
    logoLightBase64 = await imageToBase64(logoLight);
  }
  return logoLightBase64;
}

/**
 * Get logo dimensions for jsPDF (returns width/height in mm)
 * Adjust these values based on your logo aspect ratio
 */
export function getLogoDimensions() {
  return { width: 15, height: 15 };
}

export { logoDark, logoLight };
