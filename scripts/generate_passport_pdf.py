#!/usr/bin/env python3
"""
generate_passport_pdf.py — Génération PDF du Passeport Locatif via WeasyPrint.

Usage (depuis Node.js child_process) :
    echo '<html>…</html>' | python3 generate_passport_pdf.py > passport.pdf

Lit le HTML complet sur stdin, écrit le PDF binaire sur stdout.
Erreurs WeasyPrint loggées sur stderr (capturées côté Node).

Le HTML est généré côté Node (lib/passport-html-template.ts) en injectant
les données du ViewModel. WeasyPrint se contente de rendre.

Dépendance image Docker : python3 + weasyprint + cairo + pango + fontconfig.
"""

import sys
from io import BytesIO

try:
    from weasyprint import HTML, CSS  # type: ignore
except ImportError as e:
    sys.stderr.write(
        f"[generate_passport_pdf] WeasyPrint n'est pas installé dans l'image : {e}\n"
        "Installer via : pip install --break-system-packages weasyprint\n"
    )
    sys.exit(2)


def main() -> int:
    """Lit le HTML sur stdin, écrit le PDF sur stdout."""
    try:
        html_content = sys.stdin.read()
        if not html_content.strip():
            sys.stderr.write("[generate_passport_pdf] HTML vide en entrée.\n")
            return 1

        # Génération WeasyPrint — base_url permet à WeasyPrint de résoudre
        # les ressources relatives (images, fonts) si présentes.
        pdf_bytes = HTML(string=html_content, base_url='.').write_pdf()

        if not pdf_bytes:
            sys.stderr.write("[generate_passport_pdf] WeasyPrint a renvoyé un PDF vide.\n")
            return 1

        # Écriture binaire sur stdout.
        sys.stdout.buffer.write(pdf_bytes)
        sys.stdout.buffer.flush()
        return 0
    except Exception as e:
        sys.stderr.write(f"[generate_passport_pdf] Erreur : {e}\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
