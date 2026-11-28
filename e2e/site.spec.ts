import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** The listing's route (ADR-0023); `/` redirects to it. */
const LISTING = "/uhmwpe-backpacks";

/** WCAG 2.2 AA (unified brief) plus axe's best practices, which include heading order and landmarks. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa", "best-practice"];

/** Console errors, page errors and CSP violations, recorded from before the page's first byte is parsed. */
async function watch(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || /content security policy/i.test(message.text())) problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  // Injected by the browser's debugging protocol, so the page's CSP does not apply to it.
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(`CSP violation: ${event.effectiveDirective}`);
    });
  });
  return problems;
}

/** Every bag page the listing links to, in listing order, each once. */
async function bagPaths(page: Page): Promise<string[]> {
  await page.goto(LISTING);
  const hrefs = await page.locator("main ol a").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  return [...new Set(hrefs)];
}

/** Heading levels in document order. */
const headingLevels = (page: Page) =>
  page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((hs) => hs.map((h) => Number(h.tagName.slice(1))));

function expectHeadingsInOrder(levels: number[]): void {
  expect(levels[0]).toBe(1);
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i] ?? 0).toBeLessThanOrEqual((levels[i - 1] ?? 0) + 1);
}

test("the listing and every bag page load with no script, one h1, headings in order and no console problem", async ({
  page,
}) => {
  const problems = await watch(page);
  const bags = await bagPaths(page);
  expect(bags.length).toBeGreaterThan(0);
  const titles = new Set<string>();
  for (const path of [LISTING, ...bags]) {
    expect(path).toMatch(/^\/(?:uhmwpe-backpacks|bags\/[a-z0-9]+(?:-[a-z0-9]+)*)$/);
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(await page.locator("script").count(), path).toBe(0);
    expectHeadingsInOrder(await headingLevels(page));
    titles.add(await page.title());
  }
  expect(titles.size).toBe(bags.length + 1);
  expect(problems).toEqual([]);
});

test("a bag page lists its builds and links back to the listing", async ({ page }) => {
  const [first] = await bagPaths(page);
  await page.goto(first ?? "/");
  await expect(page.locator("h1")).toHaveCount(1);
  expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
  await expect(page.locator("thead th")).toHaveText(["Build", "Weight", "Capacity", "Fabric"]);
  await page.getByRole("link", { name: "All backpacks" }).click();
  await expect(page).toHaveURL(LISTING);
});

test("/ redirects to the listing with a temporary redirect", async ({ page }) => {
  const response = await page.request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(new URL(response.headers().location ?? "", "http://127.0.0.1").pathname).toBe(LISTING);
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe(LISTING);
  await expect(page.locator("h1")).toHaveText("Backpacks");
});

test("an unknown address gets the 404 page with status 404", async ({ page }) => {
  const response = await page.goto("/bags/no-such-bag");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
  await expect(page.locator(`main a[href="${LISTING}"]`)).toBeVisible();
});

test("a page address with a trailing slash redirects to the one without", async ({ page }) => {
  const [first = ""] = await bagPaths(page);
  for (const path of [LISTING, first]) {
    const response = await page.goto(`${path}/`);
    expect(response?.status(), path).toBe(200);
    expect(new URL(page.url()).pathname).toBe(path);
  }
});

test("every page sends the security headers, with a hash-only CSP", async ({ page }) => {
  const bags = await bagPaths(page);
  for (const path of [LISTING, bags[0] ?? LISTING, "/no-such-page"]) {
    const response = await page.request.get(path);
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    const directives = new Map(
      csp.split(";").map((part) => {
        const [name = "", ...sources] = part.trim().split(/\s+/);
        return [name, sources] as const;
      }),
    );
    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'none'"]);
    for (const name of ["script-src", "style-src"]) {
      const sources = directives.get(name) ?? [];
      expect(sources.length, name).toBeGreaterThan(0);
      for (const source of sources) expect(source, name).toMatch(/^(?:'none'|'sha256-[A-Za-z0-9+/]+={0,2}')$/);
    }
    expect(csp).not.toMatch(/unsafe|\*|https?:/);
    expect(headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  }
});

test("axe finds no WCAG 2.2 AA or best-practice violation on each template", async ({ page }) => {
  const bags = await bagPaths(page);
  for (const path of [LISTING, bags[0] ?? LISTING, "/no-such-page"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(
      results.violations.map((v) => `${path} ${v.id}: ${v.nodes.length}`),
      path,
    ).toEqual([]);
  }
});

test("the keyboard reaches every link in page order, with a visible focus ring", async ({ page }) => {
  const bags = await bagPaths(page);
  for (const path of [LISTING, bags[0] ?? LISTING]) {
    await page.goto(path);
    const expected = await page
      .locator("a[href], [tabindex='0']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? `tabindex:${el.className}`));
    const reached: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          id: el.getAttribute("href") ?? `tabindex:${el.className}`,
          ring: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2,
        };
      });
      expect(focused?.ring, `${path}: focus ring on ${focused?.id}`).toBe(true);
      reached.push(focused?.id ?? "");
    }
    expect(reached, path).toEqual(expected);
  }
});

test("no page scrolls sideways at 320 px wide", async ({ page }) => {
  const bags = await bagPaths(page);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of [LISTING, ...bags, "/no-such-page"]) {
    await page.goto(path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(320);
  }
});

test("no page scrolls sideways at 320 px wide with the text size at 200% (N12)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "the browser's text size is set through the Chromium DevTools protocol");
  const bags = await bagPaths(page);
  await page.setViewportSize({ width: 320, height: 640 });
  // The browser's own text-size setting, as a visitor would raise it: 32 px default instead of 16 px.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  for (const path of [LISTING, ...bags, "/no-such-page"]) {
    await page.goto(path);
    const { width, rootFont } = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      rootFont: getComputedStyle(document.documentElement).fontSize,
    }));
    expect(rootFont, path).toBe("32px");
    expect(width, path).toBeLessThanOrEqual(320);
  }
});

test("each card keeps its labels with their values at phone widths (G1)", async ({ page }) => {
  for (const width of [360, 400]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(LISTING);
    const problems = await page.locator("main ol > li dl").evaluateAll((lists) =>
      lists.flatMap((dl) => {
        const terms = [...dl.querySelectorAll("dt")];
        return terms.flatMap((dt, i) => {
          const dd = dt.nextElementSibling;
          if (!dd || dd.tagName !== "DD") return [`${dt.textContent}: no value after the label`];
          const t = dt.getBoundingClientRect();
          const d = dd.getBoundingClientRect();
          const sameLine = Math.abs(d.top - t.top) < 2 && d.left >= t.right - 1;
          const below = d.top >= t.bottom - 1 && Math.abs(d.left - t.left) < 2;
          const next = terms[i + 1]?.getBoundingClientRect();
          const out: string[] = [];
          if (!sameLine && !below) out.push(`${dt.textContent}: value neither beside nor directly below its label`);
          if (next && next.top < Math.max(t.bottom, d.bottom) - 1)
            out.push(`${dt.textContent}: next label on its line`);
          return out;
        });
      }),
    );
    expect(problems, `${width} px`).toEqual([]);
  }
});

test("both templates restore from the back/forward cache (N10)", async ({ playwright, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "the browser is launched here with Chromium's back/forward cache enabled");
  // Playwright starts Chromium with --disable-back-forward-cache, and its headless shell never caches, so this test
  // launches full Chromium (new headless) without that switch. A restored page fires pageshow with persisted set and
  // no load event, so navigation waits only for commit and then for the page's own pageshow record. Each page clears
  // its record on pagehide, so it enters the cache with none and a record seen later is from its own restore (N15).
  const browser = await playwright.chromium.launch({
    channel: "chromium",
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
  });
  try {
    const { baseURL, colorScheme } = testInfo.project.use;
    const page = await browser.newPage({ baseURL: baseURL ?? "", colorScheme: colorScheme ?? "light" });
    await page.addInitScript(() => {
      addEventListener("pagehide", () => {
        delete document.documentElement.dataset.persisted;
      });
      addEventListener("pageshow", (event) => {
        document.documentElement.dataset.persisted = String((event as PageTransitionEvent).persisted);
      });
    });
    const [bag = ""] = await bagPaths(page);
    const shown = async (path: string) => {
      await page.waitForFunction(
        (expected) => location.pathname === expected && document.documentElement.dataset.persisted !== undefined,
        path,
      );
      return page.evaluate(() => document.documentElement.dataset.persisted);
    };
    await page.goto(bag);
    await page.goBack({ waitUntil: "commit" });
    expect(await shown(LISTING), "listing, back").toBe("true");
    await page.goForward({ waitUntil: "commit" });
    expect(await shown(bag), "bag page, forward").toBe("true");
  } finally {
    await browser.close();
  }
});

test("the page follows the system colour scheme", async ({ page }, testInfo) => {
  await page.goto(LISTING);
  const dark = testInfo.project.name.endsWith("-dark");
  const [r = 0, g = 0, b = 0] = await page.evaluate(() =>
    (getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? []).map(Number),
  );
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  expect(dark ? luminance < 0.2 : luminance > 0.8).toBe(true);
});

test("pages are complete with scripts off", async ({ browser, page }) => {
  const bags = await bagPaths(page);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const off = await context.newPage();
    for (const path of [LISTING, bags[0] ?? LISTING]) {
      await page.goto(path);
      await off.goto(new URL(path, page.url()).href);
      expect(await off.locator("main").textContent(), path).toBe(await page.locator("main").textContent());
    }
  } finally {
    await context.close();
  }
});
