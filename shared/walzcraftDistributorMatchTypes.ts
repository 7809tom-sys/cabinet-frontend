export interface DistributorProfileMatch {
  rank: number;
  /** WalzCraft door/profile name exactly as in the CSV walzcraft_match column. */
  walzcraft: string;
  /** CSV confidence column (profile match %). */
  confidencePct: number;
  /** CSV walzcraft_profile column (SR stile/rail code or note). */
  profileCode: string | null;
  /** WalzCraft catalog side-profile drawing, when one exists for profileCode. */
  drawing: string | null;
  /** Id in WALZCRAFT_PROFILE_TEMPLATES when the match is one of the picker templates. */
  templateId: string | null;
}

export interface DistributorDoorMatch {
  id: string;
  distributor: "Faircrest" | "Kitchen Crest" | "DL Cabinetry" | "AltaEuro" | string;
  code: string;
  /** Distributor-facing door name; null when no source file names this code. */
  doorName: string | null;
  group: string;
  geometry: string;
  walzcraftColor: string | null;
  /** Always null: the CSVs carry no per-color percentage. */
  colorMatchPct: number | null;
  colorEstimated: boolean;
  colorSourceText: string;
  unknowns: string[];
  photo: string | null;
  sheet: string;
  matches: DistributorProfileMatch[];
}
