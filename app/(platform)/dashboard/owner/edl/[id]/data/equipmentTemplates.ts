const EQUIPMENT_BY_ROOM: Record<string, string[]> = {
  cuisine: [
    'Évier', 'Robinet', 'Plaques de cuisson', 'Hotte', 'Four',
    'Réfrigérateur', 'Plan de travail', 'Placards', 'Prise électrique',
  ],
  'salle de bain': [
    'Baignoire/Douche', 'Lavabo', 'Robinetterie', 'Miroir',
    'Sèche-serviettes', 'Prise électrique', 'Ventilation',
  ],
  wc: ['Cuvette', 'Abattant', "Chasse d'eau", 'Porte-papier', 'Lave-mains'],
  chambre: [
    'Placard/Penderie', 'Volets/Stores', 'Prises électriques',
    'Interrupteurs', 'Radiateur', 'Fenêtre(s)',
  ],
  salon: [
    'Prises électriques', 'Interrupteurs', 'Volets/Stores',
    'Radiateur', 'Fenêtre(s)', 'Cheminée',
  ],
  entrée: [
    "Porte d'entrée", 'Serrure', 'Interphone/Digicode',
    'Boîte aux lettres', 'Interrupteur', 'Placard',
  ],
  _default: [
    'Prises électriques', 'Interrupteurs', 'Radiateur',
    'Fenêtre(s)', 'Volets/Stores', 'Porte',
  ],
};

const ROOM_KEYS = Object.keys(EQUIPMENT_BY_ROOM).filter((k) => k !== '_default');

export function getEquipmentForRoom(roomName: string): string[] {
  const lower = roomName.toLowerCase();
  const match = ROOM_KEYS.find((k) => lower.includes(k));
  return EQUIPMENT_BY_ROOM[match || '_default'];
}
