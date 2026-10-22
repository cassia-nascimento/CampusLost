import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChangeFeed } from "./events";
import { createHarness, rawItem } from "./test-utils";

describe("subscribe por releitura periódica (AC04.8)", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  function feed(visible = { value: true }) {
    return {
      visible,
      feed: createChangeFeed({ pollMs: 15_000, minGapMs: 5_000, isVisible: () => visible.value, now: () => Date.now() }),
    };
  }

  it("avisa a cada intervalo, só com a aba visível", () => {
    const { feed: f, visible } = feed();
    const listener = vi.fn();
    f.subscribe(listener);
    vi.advanceTimersByTime(15_000);
    expect(listener).toHaveBeenCalledTimes(1);
    visible.value = false;
    vi.advanceTimersByTime(60_000);
    expect(listener).toHaveBeenCalledTimes(1);
    visible.value = true;
    vi.advanceTimersByTime(15_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("um único temporizador para todos os ouvintes; para quando o último sai", () => {
    const { feed: f } = feed();
    const a = vi.fn();
    const b = vi.fn();
    const offA = f.subscribe(a);
    const offB = f.subscribe(b);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(15_000);
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
    offA();
    expect(vi.getTimerCount()).toBe(1);
    offB();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("notify avisa na hora e adia a próxima releitura periódica próxima demais (sem tempestade)", () => {
    const { feed: f } = feed();
    const listener = vi.fn();
    f.subscribe(listener);
    vi.advanceTimersByTime(14_000);
    f.notify();
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000); // o tick de 15 s cai a 1 s do aviso
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ouvinte que se cancela durante o aviso não quebra os demais", () => {
    const { feed: f } = feed();
    const b = vi.fn();
    const offA = f.subscribe(() => offA());
    f.subscribe(b);
    f.notify();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("mutação do serviço dispara uma releitura imediata dos ouvintes", async () => {
    vi.useRealTimers();
    const { api, services } = createHarness();
    const listener = vi.fn();
    const off = services.subscribe(listener);
    api.reply({ status: 204 });
    await services.items.delete("item-03");
    expect(listener).toHaveBeenCalledTimes(1);
    api.reply({ json: [rawItem] });
    await services.items.list(); // leitura não notifica
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
