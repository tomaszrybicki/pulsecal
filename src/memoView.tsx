import { memo, useRef, type ComponentType } from "react";

type Fn = (...args: unknown[]) => unknown;

/**
 * Widok, który nie renderuje się od nowa, gdy rodzic podaje tylko nowe funkcje (inline callbacki w App):
 * funkcje zamienia na stałe „pośredniki”, które zawsze wołają najnowszą wersję; resztę propsów porównuje
 * zwykłe `memo`. Dzięki temu np. otwarcie okna wpisu nie przelicza całego miesiąca.
 * Uwaga: funkcja ≠ komponent — nie podawać tak typów komponentów (byłyby opakowane).
 */
export function memoView<P extends object>(Comp: ComponentType<P>): ComponentType<P> {
  const Inner = memo(Comp) as unknown as ComponentType<Record<string, unknown>>;
  function Stable(props: P) {
    const latest = useRef(props);
    latest.current = props;
    const proxies = useRef(new Map<string, Fn>());
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (typeof v !== "function") {
        next[k] = v;
        continue;
      }
      let f = proxies.current.get(k);
      if (!f) {
        f = (...args: unknown[]) => ((latest.current as Record<string, Fn | undefined>)[k] as Fn)(...args);
        proxies.current.set(k, f);
      }
      next[k] = f;
    }
    return <Inner {...next} />;
  }
  Stable.displayName = `memoView(${Comp.displayName || Comp.name})`;
  return Stable;
}
