export interface Scene {
  id: string;
  /** Name shown in the HUD (pt-BR). */
  name: string;
  build(): void;
  update(dt: number): void;
  render(): void;
  debug(): string;
}
