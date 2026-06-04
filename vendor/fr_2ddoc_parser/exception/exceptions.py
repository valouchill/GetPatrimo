class TwoDDocError(Exception):
    """Erreur générique 2D-DOC."""


class TwoDDocFormatError(TwoDDocError):
    """Chaîne 2D-DOC mal formée."""


class TwoDDocUnsupportedVersion(TwoDDocError):
    """Version d'en-tête non supportée par ce parseur (DC04 uniquement)."""


class TwoDDocSignatureError(TwoDDocError):
    """Signature invalide ou introuvable."""
