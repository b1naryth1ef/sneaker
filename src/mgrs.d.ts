declare module "mgrs" {
  export function forward(ll: [number, number], accuracy?: number): string;
  export function toPoint(mgrs: string): [number, number];
}
