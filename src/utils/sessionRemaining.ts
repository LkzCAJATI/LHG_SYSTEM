import type { Session } from '../types';

/** Total da sessão em segundos (inteiro), alinhado a transfer/start para evitar drift de float. */
export function sessionTotalSeconds(session: Pick<Session, 'duration'> | undefined): number {
  return Math.max(0, Math.round((Number(session?.duration) || 0) * 60));
}

/** Segundos já decorridos desde o início (pausa congela pelo anchor em pausedAt). */
export function sessionElapsedSeconds(
  session: Pick<Session, 'startTime' | 'isPaused' | 'pausedAt' | 'totalPausedTime'> | undefined,
  nowMs = Date.now()
): number {
  if (!session?.startTime) return 0;
  const startMs = new Date(session.startTime).getTime();
  if (!Number.isFinite(startMs) || startMs <= 0) return 0;
  const anchorMs =
    session.isPaused && session.pausedAt ? new Date(session.pausedAt).getTime() : nowMs;
  return Math.floor(Math.max(0, anchorMs - startMs - (session.totalPausedTime || 0)) / 1000);
}

export function sessionRemainingSeconds(
  session: Session | undefined,
  nowMs = Date.now()
): number {
  if (!session?.startTime) return 0;
  return Math.max(0, sessionTotalSeconds(session) - sessionElapsedSeconds(session, nowMs));
}
