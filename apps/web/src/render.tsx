import type { CatalogueModel } from "@cj/schema";
import { renderToString } from "@solidjs/web";
import { BagPage, ListingPage, NotFoundPage, SiteLayout } from "./pages.tsx";

export type StaticPage =
  | { kind: "listing"; models: readonly CatalogueModel[] }
  | { kind: "bag"; model: CatalogueModel }
  | { kind: "notFound" };

/**
 * The server entry of the static build: one page's `<body>` content as HTML. The site plugin
 * (`build/static-site.ts`) loads it through Vite's module runner, where the Solid plugin compiles it for the server
 * in its non-hydratable mode, so the output has no hydration keys; `noScripts` keeps Solid from adding a script. The
 * plugin wraps the result in the document.
 */
export function renderBody(page: StaticPage): string {
  return renderToString(
    () => (
      <SiteLayout>
        {page.kind === "listing" ? (
          <ListingPage models={page.models} />
        ) : page.kind === "bag" ? (
          <BagPage model={page.model} />
        ) : (
          <NotFoundPage />
        )}
      </SiteLayout>
    ),
    { noScripts: true },
  );
}
