import type { Device } from '../types';

export function normalizeLanIp(ip: string | undefined | null): string | null {
  if (!ip || typeof ip !== 'string') return null;
  const t = ip.trim();
  if (!t) return null;
  if (t.startsWith('::ffff:')) return t.slice(7);
  return t;
}

type ClientLite = { id: string; ip?: string; connected?: boolean };

/**
 * O WebSocket do cliente usa o ID informado no terminal (ex.: pc-01).
 * O cadastro do aparelho no servidor costuma usar UUID — este helper acha o socket certo.
 */
export function resolveWsDeviceId(
  serverDeviceId: string,
  devices: Device[],
  clients: ClientLite[]
): string | null {
  const device = devices.find((d) => d.id === serverDeviceId);
  const online = clients.filter((c) => c.connected);

  const hasConn = (id: string) => online.some((c) => c.id === id);

  const bound = device?.networkClientId?.trim();
  if (bound && hasConn(bound)) return bound;

  if (hasConn(serverDeviceId)) return serverDeviceId;

  const dip = device ? normalizeLanIp(device.ip) : null;
  if (dip) {
    const hit = online.find((c) => normalizeLanIp(c.ip) === dip);
    if (hit) return hit.id;
  }

  return null;
}
