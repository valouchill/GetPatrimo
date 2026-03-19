function normalizeDpi(value, fallback = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function toStableBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return Buffer.from(input);
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(input));
  }

  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input);
  }

  throw new TypeError('Unsupported PDF buffer input type');
}

function cloneStablePdfBytes(stableBuffer) {
  return Uint8Array.from(stableBuffer);
}

function buildPdfRenderStrategies(preferredDpi = 200) {
  const dpi = normalizeDpi(preferredDpi, 200);
  const secondaryDpi = Math.max(36, Math.round(dpi * 0.75));
  const tertiaryDpi = Math.max(24, Math.round(dpi * 0.5));

  const candidates = [dpi, secondaryDpi, tertiaryDpi];
  if (dpi > 72) {
    candidates.push(72);
  }

  const seen = new Set();

  return candidates
    .filter((candidate) => {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      return true;
    })
    .map((candidate, index) => ({
      dpi: candidate,
      name: index === 0
        ? `Resolution cible (${candidate} DPI)`
        : `Resolution de secours (${candidate} DPI)`,
    }));
}

function isDetachedArrayBufferError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /detached ArrayBuffer/i.test(message);
}

function getPdfConversionUserMessage(error) {
  if (isDetachedArrayBufferError(error)) {
    return {
      details: 'Erreur interne temporaire du moteur de conversion PDF',
      advice: 'Le rendu du PDF a echoue cote serveur. Reessayez une fois. Si le probleme persiste, contactez le support ou utilisez temporairement une image JPG/PNG.',
    };
  }

  return {
    details: error instanceof Error ? error.message : 'Erreur inconnue',
    advice: 'Document non analysable. Essayez de convertir votre PDF en image JPG/PNG, verifiez que le PDF n\'est pas protege par mot de passe, ou utilisez un PDF natif (non scanne) si possible.',
  };
}

module.exports = {
  buildPdfRenderStrategies,
  cloneStablePdfBytes,
  getPdfConversionUserMessage,
  isDetachedArrayBufferError,
  toStableBuffer,
};
