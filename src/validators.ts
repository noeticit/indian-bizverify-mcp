export const GSTIN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

// CIN: [L/U][5-digit NIC][2-char state][4-digit year][3-char type][6-digit seq]
export function isValidCIN(cin: string): boolean {
  return /^[LUu][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(cin);
}

// GSTIN: [2-digit state][10-char PAN][entity][Z][checksum]
export function isValidGSTIN(gstin: string): boolean {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return false;
  }
  return validateGSTINChecksum(gstin);
}

export function validateGSTINChecksum(gstin: string): boolean {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const idx = chars.indexOf(gstin[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = idx * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkDigit = chars[(36 - (sum % 36)) % 36];
  return checkDigit === gstin[14];
}

// PAN: [5 alpha][4 digits][1 alpha]
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
}

const PAN_ENTITY_TYPES: Record<string, string> = {
  P: "Individual",
  C: "Company",
  H: "HUF",
  F: "Firm",
  A: "AOP",
  T: "Trust",
  B: "BOI",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government",
};

export function getPANEntityType(pan: string): { code: string; description: string } {
  const code = pan[3];
  return { code, description: PAN_ENTITY_TYPES[code] ?? "Unknown" };
}

// Udyam: UDYAM-[2-char state]-[2-digit]-[7-digit]
export function isValidUdyamNumber(udyam: string): boolean {
  return /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(udyam);
}

export function getStateFromGSTIN(gstin: string): { code: string; name: string } {
  const code = gstin.substring(0, 2);
  return { code, name: GSTIN_STATE_CODES[code] ?? "Unknown" };
}
