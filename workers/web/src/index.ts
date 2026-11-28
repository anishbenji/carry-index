// Placeholder Worker so the toolchain checks Workers types. It declares no bindings (see `bun run wall`);
// the spike PR that owns this Worker replaces it.
export default {
  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
