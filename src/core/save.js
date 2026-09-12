/* 存档基建:防抖写 localStorage。序列化函数由 serialize.js 反向注册,
   避免底层模块(kit / 组件定义)反向依赖上层的序列化逻辑。 */

export const LSKEY = 'aethersynth.patch.v2';
export const RATE_KEY = 'aethersynth.rate';

/* 旧版(GridMod)键名:读取时回退,老用户存档不丢 */
const LEGACY_KEYS = {
  [LSKEY]: 'gridmod.patch.v2',
  [RATE_KEY]: 'gridmod.rate'
};

export function readSaved(key) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : localStorage.getItem(LEGACY_KEYS[key]);
  } catch (e) { return null; }
}

let _serialize = null;
let saveT = null;

export function setSerializer(fn) { _serialize = fn; }

export function saveSoon() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    if (!_serialize) return;
    try { localStorage.setItem(LSKEY, JSON.stringify(_serialize())); } catch (e) {}
  }, 400);
}

export function saveNow() {
  if (!_serialize) return;
  try { localStorage.setItem(LSKEY, JSON.stringify(_serialize())); } catch (e) {}
}
