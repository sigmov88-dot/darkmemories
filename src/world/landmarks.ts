/**
 * Единый источник правды о ключевых точках мира.
 * Квест, руины и тесты ссылаются сюда — при переносе алтаря
 * правится одно место.
 */
export const SHARD_SPOTS: ReadonlyArray<readonly [number, number, string]> = [
  [-8.6, -4.2, 'дальняя могила'],
  [5.5, 2.5, 'часовня'],
  [-10.5, 34.2, 'за амбаром'],
  [9.5, -3.0, 'за часовней'],
  [3.9, -21.2, 'двор замка']
];

export const ALTAR_POS = { x: 0, z: -18, interactR: 4.6 } as const;
export const PORTAL_POS = { x: 0, z: -21.5, triggerR: 1.7 } as const;
export const SHARD_TAKE_R = 1.6;
