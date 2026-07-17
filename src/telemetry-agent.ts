import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { collectContainerTelemetry, collectGpuTelemetry, collectHostTelemetry, createDockerClient } from './telemetry-core.js';

const app = express(), port = Number(process.env.TELEMETRY_AGENT_PORT || 9469);
const token = process.env.TELEMETRY_AGENT_TOKEN || '';
if (token.length < 32) {
  console.error('TELEMETRY_AGENT_TOKEN must contain at least 32 characters');
  process.exit(1);
}
const docker = createDockerClient();

function authorized(header: string | undefined) {
  const supplied = header?.replace(/^Bearer\s+/i, '') || '';
  const expectedBuffer = Buffer.from(token), suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'JellyPulse telemetry agent' }));
app.get('/metrics', async (req, res) => {
  if (!authorized(req.header('authorization'))) return res.status(401).json({ error: 'Invalid telemetry agent token' });
  let [container, gpu] = await Promise.all([
    collectContainerTelemetry(docker, process.env.JELLYFIN_CONTAINER_NAME),
    collectGpuTelemetry({
      url: process.env.GPU_METRICS_URL,
      metricName: process.env.GPU_METRIC_NAME,
      scale: Number(process.env.GPU_METRIC_SCALE || 1),
      vendor: process.env.GPU_METRICS_VENDOR
    })
  ]);
  if (!container.available && process.env.TELEMETRY_HOST_FALLBACK !== 'false') container = await collectHostTelemetry();
  res.json({ capturedAt: new Date().toISOString(), container, gpu });
});

app.listen(port, () => console.log(`JellyPulse telemetry agent listening on :${port}`));
