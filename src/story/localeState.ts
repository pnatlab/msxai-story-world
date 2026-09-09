export type Locale = "en" | "th";

export const DEFAULT_LOCALE: Locale = "en";

export type LocaleListener = (locale: Locale) => void;

/** Presentation-only locale state; it never owns or mutates story state. */
export class LocaleController {
  private locale: Locale = DEFAULT_LOCALE;
  private readonly listeners = new Set<LocaleListener>();

  public getLocale(): Locale {
    return this.locale;
  }

  public subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    listener(this.locale);
    return () => this.listeners.delete(listener);
  }

  public setLocale(locale: Locale): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.listeners.forEach((listener) => listener(this.locale));
  }
}
