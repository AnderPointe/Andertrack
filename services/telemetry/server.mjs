import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createPipeline, normalizeTelemetry} from './core.mjs';

const required = name => {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
};
const url = new URL(required('SUPABASE_URL'));
if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
const key = required('SUPABASE_SERVICE_ROLE_KEY');
const token = required('TELEMETRY_INGEST_TOKEN');
if (token.length < 32) throw new Error('Use an ingest token of at least 32 characters');
const organizationId = required('TELEMETRY_ORGANIZATION_ID');
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) throw new Error('Invalid organization UUID');
const pipeline = createPipeline({organizationId, async send(path, body) {
  const response = await fetch(new URL(path, url), {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  // Do not log upstream bodies or headers (may contain credentials / fleet data).
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
}});
let inFlight = 0;
const server = createServer(async (req, res) => {
  const reply = (status, message) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify({message})); };
  if (req.method !== 'POST' || req.url !== '/telemetry') { reply(404, 'Not found'); req.resume(); return; }
  const supplied = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { reply(401, 'Unauthorized'); req.resume(); return; }
  if (!(req.headers['content-type'] || '').startsWith('application/json')) { reply(415, 'Expected application/json'); req.resume(); return; }
  if (inFlight >= 50) { reply(503, 'Busy; retry later'); req.resume(); return; }
  inFlight++;
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 16384) { reply(413, 'Payload too large'); req.destroy(); return; }
    }
    let input;
    try { input = JSON.parse(body); normalizeTelemetry(input, organizationId); }
    catch { reply(400, 'Invalid telemetry payload'); return; }
    try {
      const inventoryUrl = new URL('/rest/v1/at_vehicles', url);
      inventoryUrl.search = new URLSearchParams({select: 'id', organization_id: `eq.${organizationId}`, unit_number: `eq.${input.truck_id}`, enabled: 'eq.true', limit: '1'});
      const inventory = await fetch(inventoryUrl, {signal: AbortSignal.timeout(10000),
        headers: {apikey: key, Authorization: `Bearer ${key}`}});
      if (!inventory.ok) throw new Error('Inventory unavailable');
      if (!(await inventory.json()).length) { reply(422, 'Unknown or disabled truck'); return; }
      await pipeline.ingest(input);
      reply(202, 'Queued in memory; not a durable acknowledgement');
    }
    catch { reply(503, 'Upstream unavailable or queue full; retry'); }
  } catch { if (!res.headersSent) reply(400, 'Incomplete request'); }
  finally { inFlight--; }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
const flush = () => pipeline.flush().catch(() => console.error('Telemetry state flush failed; retaining pending ticks'));
const timer = setInterval(flush, 10000);
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  clearInterval(timer);
  server.close(async () => {
    while (pipeline.size) {
      try { await pipeline.flush(); }
      catch { console.error('Shutdown flush failed; pending telemetry lost'); process.exitCode = 1; break; }
    }
  });
});
