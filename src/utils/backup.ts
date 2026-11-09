import { AppData } from '../types';

export const BACKUP_APP_ID = 'tontine-menoje';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exported_at: string;
  data: AppData;
}

/** Construit l'objet de sauvegarde versionné. */
export const createBackup = (data: AppData): BackupFile => ({
  app: BACKUP_APP_ID,
  version: BACKUP_VERSION,
  exported_at: new Date().toISOString(),
  data,
});

/**
 * Valide et extrait les données d'un fichier de sauvegarde.
 * Lève une Error avec un message en français si le fichier est inutilisable.
 */
export const parseBackup = (raw: string): AppData => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.");
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Le fichier de sauvegarde est vide ou illisible.');
  }

  const candidate = parsed as Partial<BackupFile> & { data?: unknown };
  if (candidate.app !== BACKUP_APP_ID) {
    throw new Error("Ce fichier ne provient pas de l'application Tontine M.E.NO.JE.");
  }

  if (!candidate.data || typeof candidate.data !== 'object') {
    throw new Error('Sauvegarde incomplète : aucune donnée trouvée.');
  }

  const data = candidate.data as Partial<AppData>;
  const arrays: Array<keyof AppData> = ['users', 'versements', 'retraits', 'sundaysList', 'annonces'];
  for (const key of arrays) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Sauvegarde incomplète : le champ « ${key} » est manquant.`);
    }
  }

  if (!data.parametres || typeof data.parametres !== 'object') {
    throw new Error('Sauvegarde incomplète : les réglages sont manquants.');
  }

  const usersValid = (data.users as AppData['users']).every(
    (user) => user && typeof user.id === 'number' && typeof user.nom_complet === 'string'
  );
  if (!usersValid) {
    throw new Error('Sauvegarde invalide : la liste des membres est corrompue.');
  }

  return data as AppData;
};

const downloadFile = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const todayStamp = (): string => new Date().toISOString().slice(0, 10);

/** Télécharge une sauvegarde JSON complète. */
export const downloadBackup = (data: AppData): void => {
  downloadFile(
    `tontine-menoje-${todayStamp()}.json`,
    JSON.stringify(createBackup(data), null, 2),
    'application/json;charset=utf-8'
  );
};

const escapeCsv = (value: string | number | undefined): string => {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const paymentLabel = (mode: string): string => {
  if (mode === 'especes') return 'Espèces';
  if (mode === 'mobile_money') return 'Mobile Money';
  if (mode === 'virement') return 'Virement';
  return mode || 'Autre';
};

/** Construit un CSV (séparateur « ; », compatible Excel) des versements et retraits. */
export const buildCsv = (data: AppData): string => {
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const rows: string[][] = [
    ['Date', 'Type', 'Membre', 'Téléphone', 'Montant', 'Mode / motif', 'Enregistré par'],
  ];

  data.versements.forEach((versement) => {
    const member = usersById.get(versement.user_id);
    const author = usersById.get(versement.enregistre_par);
    rows.push([
      versement.date_dimanche,
      'Versement',
      member?.nom_complet ?? `Membre #${versement.user_id}`,
      member?.telephone ?? '',
      String(versement.montant),
      paymentLabel(versement.mode_reglement),
      author?.nom_complet ?? '',
    ]);
  });

  data.retraits.forEach((retrait) => {
    const member = usersById.get(retrait.user_id);
    const author = usersById.get(retrait.enregistre_par);
    rows.push([
      retrait.date_retrait,
      'Retrait',
      member?.nom_complet ?? `Membre #${retrait.user_id}`,
      member?.telephone ?? '',
      String(retrait.montant),
      retrait.motif ?? '',
      author?.nom_complet ?? '',
    ]);
  });

  const [header, ...body] = rows;
  body.sort((a, b) => a[0].localeCompare(b[0]));

  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  return '\uFEFF' + [header, ...body].map((row) => row.map(escapeCsv).join(';')).join('\r\n');
};

/** Télécharge l'historique des opérations au format CSV. */
export const downloadCsv = (data: AppData): void => {
  downloadFile(
    `tontine-menoje-operations-${todayStamp()}.csv`,
    buildCsv(data),
    'text/csv;charset=utf-8'
  );
};
