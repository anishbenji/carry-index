import type { Bag } from "@cj/schema";
import { formatWeight } from "./format.ts";

/** One line of bag facts. Uses the schema's inferred type only; no Zod code reaches the page. */
export function BagSummary(props: { bag: Bag }) {
  return (
    <p>
      <strong>{props.bag.name}</strong> by {props.bag.brand}: {formatWeight(props.bag.weightGrams)},{" "}
      {props.bag.capacityLitres} L, {props.bag.fabric}
    </p>
  );
}
