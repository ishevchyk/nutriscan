// Backend always stores body-stat measurements in metric (height_cm, weight_kg).
// These helpers convert for imperial display/input only -- never persisted.

export function cmToIn(cm: number): number {
  return cm / 2.54;
}

export function inToCm(inches: number): number {
  return inches * 2.54;
}

export function kgToLb(kg: number): number {
  return kg * 2.20462;
}

export function lbToKg(lb: number): number {
  return lb / 2.20462;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
