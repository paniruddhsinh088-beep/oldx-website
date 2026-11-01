import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Resolve through the actual CLI dependency tree, not an unrelated test copy.
// These checks exercise only pure transport preparation and propagation. No
// provider account/client, network connection, credentials or cloud API is used.
const require = createRequire(import.meta.url);
const cliRequire = createRequire(
  require.resolve("firebase-tools/package.json"),
);

test("patched UUID preserves Gaxios 6 multipart request and response behavior without network", async () => {
  const { Gaxios } = cliRequire("gaxios");
  let captured,
    calls = 0;
  const client = new Gaxios();
  const response = await client.request({
    url: "https://not-contacted.invalid/synthetic",
    method: "POST",
    responseType: "json",
    multipart: [
      {
        headers: { "Content-Type": "application/json" },
        content: '{"synthetic":true}',
      },
    ],
    fetchImplementation: async (_url, options) => {
      calls++;
      const chunks = [];
      for await (const chunk of options.body) chunks.push(Buffer.from(chunk));
      captured = {
        header: options.headers["Content-Type"],
        body: Buffer.concat(chunks).toString("utf8"),
      };
      return new Response('{"accepted":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(response.data, { accepted: true });
  const boundary = captured.header.match(/boundary=([0-9a-f-]+)/)?.[1];
  assert.match(
    boundary,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(captured.body.startsWith("--" + boundary + "\r\n"), true);
  assert.match(
    captured.body,
    /Content-Type: application\/json\r\n\r\n\{"synthetic":true\}/,
  );
  assert.equal(captured.body.endsWith("--" + boundary + "--"), true);
});

test("patched OpenTelemetry preserves the Pub/Sub client trace propagation API without a provider", () => {
  const pubsubRequire = createRequire(
    cliRequire.resolve("@google-cloud/pubsub"),
  );
  const telemetry = pubsubRequire("./telemetry-tracing.js");
  const core = pubsubRequire("@opentelemetry/core");
  const api = pubsubRequire("@opentelemetry/api");
  const spanContext = {
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    traceFlags: 1,
  };
  const message = { attributes: {} };
  telemetry.setGloballyEnabled(true);
  try {
    telemetry.injectSpan({ spanContext: () => spanContext }, message);
    assert.equal(telemetry.containsSpanContext(message), true);
    assert.equal(
      message.attributes.googclient_traceparent,
      `00-${spanContext.traceId}-${spanContext.spanId}-01`,
    );
    const extracted = new core.W3CTraceContextPropagator().extract(
      api.ROOT_CONTEXT,
      message,
      telemetry.pubsubGetter,
    );
    assert.equal(
      api.trace.getSpanContext(extracted).traceId,
      spanContext.traceId,
    );
    assert.equal(
      api.trace.getSpanContext(extracted).spanId,
      spanContext.spanId,
    );
    assert.doesNotThrow(() =>
      telemetry.extractSpan(
        { attributes: { ...message.attributes } },
        "synthetic-subscription",
      ),
    );
  } finally {
    telemetry.setGloballyEnabled(false);
  }
  const disabled = {};
  telemetry.injectSpan({ spanContext: () => spanContext }, disabled);
  assert.deepEqual(disabled, {});
});
