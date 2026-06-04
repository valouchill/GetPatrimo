#!/usr/bin/env python3
"""
Module C — Décodage + vérification d'un sceau 2D-Doc (avis d'imposition, Visale…).

Lit sur STDIN soit :
  - une IMAGE (PNG/JPEG) contenant le DataMatrix → décodage via libdmtx (pylibdmtx),
  - soit la chaîne 2D-Doc BRUTE déjà décodée (commence par "DC").
Renvoie un JSON sur STDOUT.

Vérification déléguée à la lib MIT `fr_2ddoc_parser` (betagouv/2ddoc-parser), qui
embarque la liste de confiance officielle de l'ANTS (tsl_signed.xml) → vérif de
signature ECDSA HORS-LIGNE, sans l'API ANTS.

Sortie (succès) :
  {"ok": true, "decodedFrom", "docType", "version", "caId", "certId",
   "signaturePresent", "signatureValid", "algHint",
   "rfr", "referenceAvis", "numeroFiscal", "declarant1",
   "nombreParts", "anneeRevenus", "fields": {...}}
Sortie (échec) : {"ok": false, "error": "..."}

Ne lève jamais : toute erreur est renvoyée en JSON (appelant fire-and-forget).
Dépendances : pylibdmtx + Pillow (décodage), fr_2ddoc_parser + pydantic + cryptography
(vérif). Système : libdmtx0.
"""
import os
import sys
import io
import json
import contextlib
import warnings

warnings.filterwarnings("ignore")

# Lib vendorée (vendor/fr_2ddoc_parser, MIT) : ajoutée au path, relative à scripts/.
_VENDOR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vendor")
if os.path.isdir(_VENDOR) and _VENDOR not in sys.path:
    sys.path.insert(0, _VENDOR)


def emit(obj):
    sys.stdout.write(json.dumps(obj, default=str, ensure_ascii=False))


def decode_datamatrix(image_bytes):
    """Bytes d'image → liste de chaînes DataMatrix décodées (libdmtx)."""
    try:
        from PIL import Image
        from pylibdmtx.pylibdmtx import decode as dmtx_decode
    except Exception as e:
        return None, f"decoder unavailable: {e}"
    try:
        im = Image.open(io.BytesIO(image_bytes))
        # Compositer sur fond BLANC : la transparence casse le décodage DataMatrix.
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        im = im.convert("L")
        timeout = int(os.environ.get("DMTX_TIMEOUT_MS", "8000"))
        # max_count=1 : on s'arrête au PREMIER code trouvé. Sans ça, libdmtx continue
        # de balayer toute la page à la recherche d'autres codes jusqu'au timeout
        # (~10 s sur un A4 200 DPI) ; avec, c'est ~2 s. NB : ne PAS sous-échantillonner
        # (shrink>1 perd le DataMatrix de l'avis).
        max_count = int(os.environ.get("DMTX_MAX_COUNT", "1"))
        results = dmtx_decode(im, timeout=timeout, max_count=max_count)
        return [r.data.decode("utf-8", "replace") for r in results], None
    except Exception as e:
        return None, f"decode error: {e}"


def verify_string(raw):
    from fr_2ddoc_parser.api import decode_2d_doc
    # La lib écrit parfois un "Warning: ..." sur STDOUT : on capture pour garder
    # STDOUT 100% JSON.
    with contextlib.redirect_stdout(io.StringIO()):
        return decode_2d_doc(raw)


def build_output(r, decoded_from):
    try:
        fields = dict(getattr(r, "fields", {}) or {})
    except Exception:
        fields = {}
    typed = getattr(r, "typed", None)

    def g(attr):
        return getattr(typed, attr, None) if typed is not None else None

    parts = g("nombre_de_parts")
    try:
        parts = float(parts) if parts is not None else None
    except Exception:
        parts = None

    return {
        "ok": True,
        "decodedFrom": decoded_from,
        "docType": getattr(r.header, "doc_type", None),
        "version": getattr(r.header, "version", None),
        "caId": getattr(r.header, "ca_id", None),
        "certId": getattr(r.header, "cert_id", None),
        "signaturePresent": bool(getattr(r.signature, "present", False)),
        # is_valid = signature vérifiée contre la TSL ANTS embarquée.
        "signatureValid": bool(getattr(r, "is_valid", False)),
        "algHint": getattr(r.signature, "alg_hint", None),
        "rfr": g("revenu_fiscal_de_reference") or fields.get("41"),
        "referenceAvis": g("reference_avis") or fields.get("44"),
        "numeroFiscal": fields.get("47"),
        "declarant1": g("declarant_1") or fields.get("46"),
        "nombreParts": parts,
        "anneeRevenus": g("annee_des_revenus") or fields.get("45"),
        "fields": fields,
    }


def main():
    try:
        data = sys.stdin.buffer.read()
    except Exception as e:  # pragma: no cover
        emit({"ok": False, "error": f"stdin: {e}"})
        return
    if not data:
        emit({"ok": False, "error": "empty input"})
        return

    is_png = data[:8] == b"\x89PNG\r\n\x1a\n"
    is_jpg = data[:3] == b"\xff\xd8\xff"

    if is_png or is_jpg:
        decoded, err = decode_datamatrix(data)
        if decoded is None:
            emit({"ok": False, "error": err})
            return
        if not decoded:
            emit({"ok": False, "error": "no datamatrix found"})
            return
        candidates = decoded
        decoded_from = "image"
    else:
        candidates = [data.decode("utf-8", "replace").strip()]
        decoded_from = "string"

    try:
        from fr_2ddoc_parser.api import decode_2d_doc  # noqa: F401  (présence)
    except Exception as e:
        emit({"ok": False, "error": f"lib unavailable: {e}"})
        return

    last_err = None
    for s in candidates:
        if not s:
            continue
        try:
            r = verify_string(s)
            emit(build_output(r, decoded_from))
            return
        except Exception as e:
            last_err = str(e)
            continue
    emit({"ok": False, "error": last_err or "no valid 2D-Doc"})


if __name__ == "__main__":
    main()
