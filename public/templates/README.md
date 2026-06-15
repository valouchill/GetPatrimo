# Modèles de bail téléchargeables (servis statiquement)

Le sélecteur de type de bail (LeasePreparationPage) télécharge `/templates/bail-<type>.docx`.

Fichiers attendus (déposez-les ici pour activer/améliorer le téléchargement) :
- `bail-vide.docx`      — Location vide (non meublée)   [fourni]
- `bail-meuble.docx`    — Location meublée              [fourni]
- `bail-mobilite.docx`  — Bail mobilité                 [fourni]
- `bail-garage.docx`    — Garage / Parking              [fourni]
- `bail-civil.docx`     — Bail civil (droit commun)     [À DÉPOSER]
- (optionnel) `bail-<type>.pdf` pour une version PDF.

NB : les .docx fournis sont les modèles de génération (ils contiennent des
balises de fusion `{{…}}`). Pour des modèles « vierges » propres à remplir à la
main, remplacez le fichier en gardant le même nom.
