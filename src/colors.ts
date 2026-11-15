export const PALETTE = [
  { id: "coral", value: "#ff6b4a", ink: "#3a120c" },
  { id: "peach", value: "#ffb070", ink: "#3d2410" },
  { id: "mint", value: "#7ddeb2", ink: "#0f2e22" },
  { id: "sky", value: "#7eb6ff", ink: "#0e2440" },
  { id: "lilac", value: "#c9a4ff", ink: "#2a1644" },
  { id: "butter", value: "#f3d36b", ink: "#3a2c08" },
] as const;

export function colorInk(value: string): string {
  return PALETTE.find((c) => c.value === value)?.ink ?? "#1c1917";
}

export const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "#7eb6ff",
  "2": "#7ddeb2",
  "3": "#c9a4ff",
  "4": "#ff6b4a",
  "5": "#f3d36b",
  "6": "#ffb070",
  "7": "#7eb6ff",
  "8": "#c4b5a5",
  "9": "#7eb6ff",
  "10": "#7ddeb2",
  "11": "#ff6b4a",
};
