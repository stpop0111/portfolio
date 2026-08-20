'use client';

import { useEffect, useRef } from 'react';
import { button, folder, monitor, useControls } from 'leva';
import { depthOfField, productShot, verticalFov, type SensorName } from '../../../_utils/cameraPresets';

/** ピントをどこに置くか。screen / body はメッシュに追従する */
export type FocusMode = 'screen' | 'body' | 'manual';

/**
 * ピントを合わせるメッシュの名前（GLB のノード名）。
 * 親の monitor は筐体と液晶をまとめた Group なので、そのバウンディングボックスを
 * 使うと首を振ったときに箱の角へピントが寄ってしまう。狙うメッシュを直接指す。
 */
export const FOCUS_NODES = {
  /** 液晶（Model.tsx がキャンバステクスチャを貼っている面） */
  screen: 'mesh__monitor_1',
  /** 筐体 */
  body: 'mesh__monitor',
} as const;

/**
 * PC のカメラを Leva から触るためのフック。
 *
 * パネルの既定値＝いま公開している見た目。触っても本番の初期表示は変わらないので、
 * 気に入った数値が出たらここの CAMERA_DEFAULTS に書き戻す運用にする。
 */

/** 直交投影のときの見え方をそのまま再現する組み合わせ */
export const CAMERA_DEFAULTS = {
  sensor: 'mediumFormat' as SensorName,
  focalLength: 80,
  target: [0, 0.06, 0] as [number, number, number],
  // 直交投影のときの視線（[0,-0.3,2] → [0,0.06,0]）
  direction: [0, -0.36, 2] as [number, number, number],
  // 旧 zoom 300 × 画面高 900px と同じ写り
  frameHeight: 3,
  // ピントを置く面＝PC の前面。注視点より 0.67 ほど手前
  subjectDepth: 0.67,
};

export const CAMERA_INITIAL = productShot(CAMERA_DEFAULTS);

// パースは深度が非線形なので、既定の 0.1〜1000 のままだと N8AO の精度が落ちる
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 100;

/** 実在する絞り値の段（1段ごと） */
const F_STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

/**
 * このシーンの 1 ワールド単位が実寸で何 mm か。
 * 被写界深度は「実際の距離」で決まるので、この換算がないと F 値が意味を持たない。
 * PC 本体の横幅がおよそ 1 ユニットなので、20cm 台の卓上機を想定した値。
 */
const DEFAULT_UNIT_MM = 285;

type Vec3 = { x: number; y: number; z: number };
const toTuple = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];
const toVec3 = ([x, y, z]: [number, number, number]): Vec3 => ({ x, y, z });

export function useProductCamera() {
  // onChange / button から最新値を読むための控え。
  // useControls のスキーマは初回しか評価されないので、クロージャに値を直接
  // 閉じ込めると古い数値を掴んでしまう
  const latest = useRef({
    position: CAMERA_INITIAL.position,
    target: CAMERA_DEFAULTS.target,
    focalLength: CAMERA_DEFAULTS.focalLength,
    sensor: CAMERA_DEFAULTS.sensor,
  });
  const setRef = useRef<((value: Record<string, unknown>) => void) | null>(null);
  // 実際のピント距離。毎フレーム FocusRig が書き込み、パネルはこれを覗く
  const focusDistanceRef = useRef(CAMERA_INITIAL.distance - CAMERA_DEFAULTS.subjectDepth);

  /** 注視点からカメラへの向きを保ったまま、距離だけ変えた位置を返す */
  const moveAlongAxis = (distance: number): Vec3 => {
    const { position, target } = latest.current;
    const d: [number, number, number] = [
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    ];
    const length = Math.hypot(d[0], d[1], d[2]) || 1;
    return {
      x: target[0] + (d[0] / length) * distance,
      y: target[1] + (d[1] / length) * distance,
      z: target[2] + (d[2] / length) * distance,
    };
  };

  const [values, set] = useControls(() => ({
    カメラ: folder({
      sensor: {
        label: 'センサー',
        value: CAMERA_DEFAULTS.sensor,
        options: { '中判 53.4x40': 'mediumFormat', 'フルサイズ 36x24': 'fullFrame' },
      },
      focalLength: { label: '焦点距離 mm', value: CAMERA_DEFAULTS.focalLength, min: 20, max: 300, step: 1 },
      position: { label: 'カメラ位置', value: toVec3(CAMERA_INITIAL.position), step: 0.02 },
      target: { label: '注視点', value: toVec3(CAMERA_DEFAULTS.target), step: 0.02 },
      distance: {
        label: '距離',
        value: CAMERA_INITIAL.distance,
        min: 1,
        max: 40,
        step: 0.05,
        // 視線の向きは保ったまま前後させる。カメラ位置を直接動かしたあとは
        // このスライダーの数値だけ古くなるが、実際の距離は下の「情報」に出る
        onChange: (distance: number, _path, context) => {
          if (!context.fromPanel) return;
          setRef.current?.({ position: moveAlongAxis(distance) });
        },
      },
      '構図を合わせる（焦点距離から距離を再計算）': button(() => {
        const { target, focalLength, sensor } = latest.current;
        const shot = productShot({ ...CAMERA_DEFAULTS, sensor, focalLength, target });
        setRef.current?.({ position: toVec3(shot.position), distance: shot.distance });
      }),
      '初期値に戻す': button(() => {
        setRef.current?.({
          sensor: CAMERA_DEFAULTS.sensor,
          focalLength: CAMERA_DEFAULTS.focalLength,
          position: toVec3(CAMERA_INITIAL.position),
          target: toVec3(CAMERA_DEFAULTS.target),
          distance: CAMERA_INITIAL.distance,
        });
      }),
      info: { label: '情報', value: '', editable: false },
    }),
    ピント: folder({
      focusMode: {
        label: 'ピントの置き方',
        value: 'screen' as FocusMode,
        options: { '液晶': 'screen', '筐体': 'body', '手動': 'manual' },
      },
      focusOffset: { label: '前後の微調整', value: 0, min: -1, max: 1, step: 0.005 },
      focusManual: {
        label: '手動の距離',
        value: CAMERA_INITIAL.distance - CAMERA_DEFAULTS.subjectDepth,
        min: 0.5,
        max: 30,
        step: 0.01,
      },
      focusMarker: { label: 'ピント位置を表示', value: false },
      // 毎フレーム変わるので state ではなく ref を覗かせる。
      // monitor は label 指定を持たないのでキーがそのまま表示名になる
      '実際の距離': monitor(focusDistanceRef, { interval: 150 }),
    }),
    絞り: folder({
      dof: { label: 'ボケを出す', value: false },
      fNumber: { label: 'F値', value: 8, options: F_STOPS },
      bokehScale: { label: 'ボケの強さ', value: 3, min: 0, max: 12, step: 0.5 },
      unitMM: { label: '1単位=mm', value: DEFAULT_UNIT_MM, min: 20, max: 2000, step: 5 },
      dofInfo: { label: 'ピント範囲', value: '', editable: false },
    }),
  }));

  // leva の select は string で返ってくるので、扱う型に戻す
  const sensor = values.sensor as SensorName;
  const focusMode = values.focusMode as FocusMode;
  const { focalLength, position, target, dof, fNumber, bokehScale, unitMM } = values;
  const { focusOffset, focusManual, focusMarker } = values;

  const positionTuple = toTuple(position);
  const targetTuple = toTuple(target);

  // onChange と button はマウント後にしか動かないので、控えの更新は描画後で間に合う
  useEffect(() => {
    latest.current = { position: positionTuple, target: targetTuple, focalLength, sensor };
    setRef.current = set;
  });

  const fov = verticalFov(sensor, focalLength);
  const distance = Math.hypot(
    positionTuple[0] - targetTuple[0],
    positionTuple[1] - targetTuple[1],
    positionTuple[2] - targetTuple[2],
  );

  // ---------------------------
  // 絞り → 被写界深度
  // ---------------------------
  // 実際のピント距離は毎フレーム FocusRig が決めるので、ここで出すのは
  // パネルに表示するための目安（構図の基準にしている被写体前面での値）
  const nominalFocus = Math.max(distance - CAMERA_DEFAULTS.subjectDepth, 0.01);
  const limits = depthOfField(sensor, focalLength, fNumber, nominalFocus * unitMM);

  const fmt = (mm: number) => (mm === Infinity ? '∞' : mm >= 1000 ? `${(mm / 1000).toFixed(2)}m` : `${Math.round(mm)}mm`);

  useEffect(() => {
    set({
      info: `画角 ${fov.toFixed(2)}° / 距離 ${distance.toFixed(2)}`,
      dofInfo: `${fmt(limits.near)} 〜 ${fmt(limits.far)}（被写体まで ${fmt(nominalFocus * unitMM)}）`,
    });
  }, [set, fov, distance, limits.near, limits.far, nominalFocus, unitMM]);

  return {
    fov,
    position: positionTuple,
    target: targetTuple,
    near: CAMERA_NEAR,
    far: CAMERA_FAR,
    dof: { enabled: dof, bokehScale },
    focus: {
      mode: focusMode,
      offset: focusOffset,
      manual: focusManual,
      marker: focusMarker,
      distanceRef: focusDistanceRef,
    },
    aperture: { sensor, focalLength, fNumber, unitMM },
  };
}
