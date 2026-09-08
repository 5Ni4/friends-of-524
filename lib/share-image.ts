import type { Friend } from './friends';
import type { FriendRenderer } from './render-friend';

export type PreparedImage = { key: string; file: File; text: string };
type ShareApi = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export async function createFriendPng(
  renderer: FriendRenderer,
  friend: Friend,
  background: string | null,
  makeCanvas = () => document.createElement('canvas'),
) {
  const canvas = makeCanvas();
  canvas.width = 2048;
  canvas.height = 2048;
  renderer.render(canvas, friend, background);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('画像を書き出せませんでした。')), 'image/png');
  });
  return new File([blob], `524-friend-${friend.eyes.replace(/[^0-9]/g, 'x')}.png`, { type: 'image/png' });
}

export function canShareImage(api: ShareApi, file: File) {
  if (typeof api.share !== 'function' || typeof api.canShare !== 'function') return false;
  try { return api.canShare({ files: [file] }); } catch { return false; }
}

// Call directly from a click. Preparing the PNG here would lose user activation on some devices.
export async function sharePreparedImage(api: ShareApi, prepared: PreparedImage | null, currentKey: string) {
  if (!prepared || prepared.key !== currentKey) return 'not-ready' as const;
  if (!canShareImage(api, prepared.file)) return 'unsupported' as const;
  try {
    await api.share!({ files: [prepared.file], text: prepared.text });
    return 'shared' as const;
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled' as const;
    throw error;
  }
}
