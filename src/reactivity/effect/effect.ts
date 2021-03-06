/**
 * effect 方法
 *
 * 思路：
 * 	1.接收一个fn
 * 	2.直接触发fn
 *	3.提供收集依赖方法，当触发 get 方法时 调用 track 方法  进行依赖收集
 *	4.提供执行依赖方法，当触发 set 方法时 调用 trigger 方法 执行收集到的所有依赖
 *  5.提供stop方法，调用时停止传入runner的执行
 */

import { extend } from "../../shared";

let activeEffect;
let shouldTrack;

// 通过对象形式创建
export class ReactiveEffect {
  private _fn: any;
  active = true;
  deps = [];
  onStop?: () => void;
  public scheduler: Function | undefined;
  constructor(fn, scheduler?: Function) {
    this._fn = fn;
    this.scheduler = scheduler;
  }
  run() {
    // 判断是不是被 stop 的状态
    if (!this.active) {
      return this._fn();
    }
    shouldTrack = true;
    activeEffect = this;
    const result = this._fn();
    shouldTrack = false;
    return result;
  }
  stop() {
    if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

function cleanupEffect(effect) {
  effect.deps.forEach((dep: any) => {
    dep.delete(effect);
  });
  effect.deps.length = 0;
}

let targetMaps = new Map();
/**
 *
 * 收集依赖方法
 *
 */
export function track(target, key) {
  if (!isTrackIng()) return;
  // target -> key -> dep
  let depMaps = targetMaps.get(target);
  // 处理初始化逻辑， 当初始化时没有 depMaps 就创建一个添加到 targetMaps 中
  if (!depMaps) {
    depMaps = new Map();
    targetMaps.set(target, depMaps);
  }
  // 处理初始化逻辑， 当初始化时没有 dep 就创建 添加到 depMaps 中
  let dep = depMaps.get(key);
  if (!dep) {
    dep = new Set();
    depMaps.set(key, dep);
  }
  trackEffects(dep);
}

/**
 * 依赖收集封装
 */
export function trackEffects(dep) {
  // 如果 activeEffect 已经被收集 就 return 不需要再次收集
  if (dep.has(activeEffect)) return;
  dep.add(activeEffect);
  // 为了在执行 stop 方法时可以取到当前 effect 所有的 dep
  activeEffect.deps.push(dep);
}

export function isTrackIng() {
  return shouldTrack && activeEffect !== undefined;
}

/**
 *
 * 依赖执行方法
 *
 */
export function trigger(target, key) {
  // 根据 target 获取到depMaps
  let depMaps = targetMaps.get(target);
  // 根据 key 获取到 deps
  let dep = depMaps.get(key);
  triggerEffects(dep);
}

export function triggerEffects(dep) {
  // 循环 deps 执行每一个 fn => run
  for (const effect of dep) {
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}

export function effect(fn, options: any = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler);
  extend(_effect, options);
  // 开始就会执行一次
  _effect.run();
  const runner: any = _effect.run.bind(_effect);
  // runner 挂载 effect 实例
  runner.effect = _effect;
  return runner;
}

/**
 * stop
 * 参数：fn
 * 当调用此方法时，会停止 传入 fn 的响应式
 */
export function stop(runner) {
  runner.effect.stop();
}
