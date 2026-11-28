import type { Bag, CatalogueModel } from "@cj/schema";
import type { JSX } from "@solidjs/web";
import { For } from "solid-js";
import { formatCapacity, formatFabric, formatWeight } from "./format.ts";
import { bagPath, LISTING_PATH } from "./routes.ts";

/**
 * The public pages of the static-first build (ADR-0015, spike PR 8). Rendered once at build time, with no hydration
 * keys and no client script; the markup uses native elements only, so it needs no script to work. Every value shown
 * comes from a `Bag` or its model's slug, name and maker: the public surface.
 */

export function SiteLayout(props: { children: JSX.Element }) {
  return (
    <>
      <header class="site">
        <a class="home" href={LISTING_PATH}>
          Carry Journal
        </a>
      </header>
      <main id="main">{props.children}</main>
    </>
  );
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Lightest first, then by name, maker and slug: a total order, 0 only for builds equal in all four. */
export const byWeight = (a: Bag, b: Bag): number =>
  a.weightGrams - b.weightGrams ||
  byCodeUnit(a.name, b.name) ||
  byCodeUnit(a.brand, b.brand) ||
  byCodeUnit(a.slug, b.slug);

export function ListingPage(props: { models: readonly CatalogueModel[] }) {
  const cards = props.models
    .flatMap((model) => model.builds.map((build) => ({ model, build })))
    .sort((a, b) => byWeight(a.build, b.build));
  return (
    <>
      <h1>Backpacks</h1>
      <p class="lede">Every bag in the catalogue, with each build's weight, capacity and main fabric.</p>
      <p class="count">
        {cards.length} builds of {props.models.length} bags, lightest first.
      </p>
      <ol class="cards">
        <For each={cards}>
          {(card) => (
            <li class="card">
              <h2>
                <a href={bagPath(card.model.slug)}>{card.build.name}</a>
              </h2>
              <dl>
                <dt>Maker</dt>
                <dd>{card.build.brand}</dd>
                <dt>Weight</dt>
                <dd>{formatWeight(card.build.weightGrams)}</dd>
                <dt>Capacity</dt>
                <dd>{formatCapacity(card.build.capacityLitres)}</dd>
                <dt>Fabric</dt>
                <dd>{formatFabric(card.build.fabric)}</dd>
              </dl>
            </li>
          )}
        </For>
      </ol>
    </>
  );
}

export function BagPage(props: { model: CatalogueModel }) {
  return (
    <>
      <p class="maker">{props.model.brand}</p>
      <h1>{props.model.name}</h1>
      <h2 id="builds">Builds</h2>
      {/* Focusable so a keyboard can scroll the table when a narrow screen makes it wider than the page. */}
      <section class="table-wrap" aria-labelledby="builds" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">Build</th>
              <th scope="col">Weight</th>
              <th scope="col">Capacity</th>
              <th scope="col">Fabric</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.model.builds}>
              {(build) => (
                <tr>
                  <th scope="row">{build.name}</th>
                  <td>{formatWeight(build.weightGrams)}</td>
                  <td>{formatCapacity(build.capacityLitres)}</td>
                  <td>{formatFabric(build.fabric)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </section>
      <p>
        <a href={LISTING_PATH}>All backpacks</a>
      </p>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        There is no page at this address. The <a href={LISTING_PATH}>backpack listing</a> has every bag.
      </p>
    </>
  );
}
