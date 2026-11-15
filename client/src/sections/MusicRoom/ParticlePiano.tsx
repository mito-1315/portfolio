import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { emitPianoNote, onPianoNote } from "../../audio/pianoBus";
import { readRgbToken } from "../../theme/theme";
import { buildPiano, keyPositions } from "./pianoGeometry";

export type PianoProgress = {
  /** 0 = scattered along the staff, 1 = fully assembled. */
  assemble: number;
  /** 0..1 across the section: the camera walks around the piano. */
  orbit: number;
};

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAssemble;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uPulse;
  uniform float uKeys[88];
  uniform vec2 uMouse;
  uniform float uForce;
  uniform float uAspect;

  attribute vec3 aStart;
  attribute float aRand;
  attribute float aKey;

  varying float vGlow;
  varying float vRand;
  varying float vFly;

  void main() {
    // Before assembly, points drift along five staff lines.
    vec3 s = aStart;
    s.x = mod(s.x + uTime * (0.22 + aRand * 0.34) + 3.6, 7.2) - 3.6;
    s.y += sin(s.x * 1.7 + uTime * 0.8 + aRand * 6.2831) * 0.045;

    float delay = aRand * 0.42;
    float p = clamp((uAssemble - delay) / 0.58, 0.0, 1.0);
    p = p * p * (3.0 - 2.0 * p);

    vec3 pos = mix(s, position, p);

    // A slow breathing once assembled, and a lift from the music.
    pos.y += sin(uTime * 0.9 + aRand * 20.0) * 0.004 * p;
    pos.y += uPulse * 0.006 * sin(aRand * 40.0 + uTime * 6.0) * p;

    float key = 0.0;
    if (aKey >= 0.0) {
      key = uKeys[int(aKey)];
      pos.y -= key * 0.012;
    }

    vGlow = key;
    vRand = aRand;
    vFly = 1.0 - p;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // The cursor pushes nearby particles away, like a hand through dust.
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec2 d = ndc - uMouse;
    d.x *= uAspect;
    float dist = length(d);
    float push = uForce * smoothstep(0.26, 0.0, dist);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0, 1.0);
    dir.x /= uAspect;
    gl_Position.xy += dir * push * 0.09 * gl_Position.w;
    gl_PointSize = uSize * uPixelRatio * (1.0 + key * 1.8 + vFly * 0.5) / max(0.5, -mv.z);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uGlowColour;

  varying float vGlow;
  varying float vRand;
  varying float vFly;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    // Colours come from the active theme: the accent, a deeper shade of it, and a glow for lit keys.
    vec3 orange = uAccent;
    vec3 deep = uAccent * 0.72;
    vec3 hot = uGlowColour;

    vec3 color = mix(deep, orange, 0.55 + vRand * 0.45);
    color = mix(color, hot, clamp(vGlow, 0.0, 1.0));

    float alpha = smoothstep(0.5, 0.18, d) * (0.62 + vGlow * 0.38 - vFly * 0.2);
    gl_FragColor = vec4(color, alpha);
  }
`;

type SceneProps = {
  count: number;
  onPlay?: (midi: number, velocity: number) => void;
  progress: React.MutableRefObject<PianoProgress>;
};

function Scene({ count, progress, onPlay }: SceneProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const pulse = useRef(0);

  const cloud = useMemo(() => buildPiano(count), [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cloud.target, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(cloud.start, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(cloud.rand, 1));
    g.setAttribute("aKey", new THREE.BufferAttribute(cloud.key, 1));
    // The points move in the shader, so skip culling by the resting bounds.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, -0.8), 6);
    return g;
  }, [cloud]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uAssemble: { value: 0 },
          uSize: { value: 15 },
          uPixelRatio: { value: 1 },
          uPulse: { value: 0 },
          uMouse: { value: new THREE.Vector2(9, 9) },
          uForce: { value: 0 },
          uAspect: { value: 1 },
          uKeys: { value: new Float32Array(88) },
          uAccent: { value: new THREE.Vector3(0.851, 0.471, 0.212) },
          uGlowColour: { value: new THREE.Vector3(1, 0.7, 0.4) },
        },
      }),
    []
  );

  // Release GPU memory when the piano goes away.
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  // The particles take the accent colour of the scene they sit in, and follow theme changes.
  const { gl } = useThree();
  useEffect(() => {
    const read = () => {
      const scene = gl.domElement.closest<HTMLElement>("[class*='scene-']") ?? document.documentElement;
      const accent = readRgbToken(scene, "--accent-rgb", [217, 120, 54]);
      const glow = readRgbToken(scene, "--glow-rgb", [255, 170, 105]);
      (material.uniforms.uAccent!.value as THREE.Vector3).set(accent[0] / 255, accent[1] / 255, accent[2] / 255);
      (material.uniforms.uGlowColour!.value as THREE.Vector3).set(glow[0] / 255, glow[1] / 255, glow[2] / 255);
    };
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, [gl, material]);

  // Every piano note the site plays lights the matching key.
  useEffect(
    () =>
      onPianoNote((midi, velocity) => {
        const keys = material.uniforms.uKeys!.value as Float32Array;
        const i = midi - 21;
        if (i >= 0 && i < 88) keys[i] = Math.max(keys[i]!, 0.6 + velocity * 0.4);
        pulse.current = Math.min(1, pulse.current + 0.35 + velocity * 0.3);
      }),
    [material]
  );

  const target = useMemo(() => new THREE.Vector3(-0.8, 1.1, -0.85), []);

  // Pointer: stir the particles, and play the key under the cursor on press or drag.
  const pointer = useRef({ x: 9, y: 9, inside: false });
  const keys = useMemo(() => keyPositions(), []);
  const onPlayRef = useRef(onPlay);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const el = gl.domElement;
    const probe = new THREE.Vector3();
    let held = false;
    let lastKey = -1;

    /** The key whose surface is nearest the cursor on screen, if close enough. */
    const keyAt = (px: number, py: number): number => {
      const rect = el.getBoundingClientRect();
      let best = -1;
      let bestDist = 26 * 26;
      for (const k of keys) {
        probe.set(k.x, k.y, k.z).project(camera);
        if (probe.z > 1) continue;
        const sx = rect.left + ((probe.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - probe.y) / 2) * rect.height;
        // Black keys sit on top, so they win a close call.
        const d = (sx - px) ** 2 + (sy - py) ** 2 - (k.black ? 90 : 0);
        if (d < bestDist) {
          bestDist = d;
          best = k.midi;
        }
      }
      return best;
    };

    const strike = (midi: number) => {
      const velocity = 0.55 + Math.random() * 0.25;
      emitPianoNote(midi, velocity);
      onPlayRef.current?.(midi, velocity);
    };

    const track = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.current.inside = true;
    };

    const onMove = (event: PointerEvent) => {
      track(event);
      const midi = keyAt(event.clientX, event.clientY);
      el.style.cursor = midi >= 0 ? "pointer" : "";
      if (held && midi >= 0 && midi !== lastKey) {
        lastKey = midi;
        strike(midi);
      }
    };
    const onDown = (event: PointerEvent) => {
      track(event);
      held = true;
      const midi = keyAt(event.clientX, event.clientY);
      lastKey = midi;
      if (midi >= 0) strike(midi);
    };
    const release = () => {
      held = false;
      lastKey = -1;
    };
    const onLeave = () => {
      pointer.current.inside = false;
      el.style.cursor = "";
      release();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", onLeave);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", release);
      el.removeEventListener("pointercancel", onLeave);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, camera, keys]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const shader = pointsRef.current?.material as THREE.ShaderMaterial | undefined;
    if (!shader) return;
    const u = shader.uniforms;
    u.uTime!.value += dt;
    u.uAssemble!.value = progress.current.assemble;
    u.uPixelRatio!.value = state.gl.getPixelRatio();
    u.uSize!.value = state.size.width < 700 ? 12 : 15;

    // Ease the cursor's push in and out, so particles drift back softly.
    const mouse = u.uMouse!.value as THREE.Vector2;
    mouse.set(pointer.current.x, pointer.current.y);
    u.uAspect!.value = state.size.width / Math.max(1, state.size.height);
    const wantForce = pointer.current.inside && progress.current.assemble > 0.9 ? 1 : 0;
    u.uForce!.value += (wantForce - (u.uForce!.value as number)) * Math.min(1, dt * 6);

    // Lit keys fade out; the whole instrument settles after a note.
    const keys = u.uKeys!.value as Float32Array;
    for (let i = 0; i < 88; i++) keys[i] = keys[i]! * Math.pow(0.1, dt);
    pulse.current *= Math.pow(0.05, dt);
    u.uPulse!.value = pulse.current;

    // The camera walks around the piano as the section scrolls, and leans
    // gently toward the cursor.
    const orbit = progress.current.orbit;
    const azimuth = -0.9 + orbit * 1.7 + state.pointer.x * 0.12;
    const elevation = 0.3 + (0.5 - Math.abs(orbit - 0.5)) * 0.1 + state.pointer.y * 0.06;
    const distance = 6.6 - orbit * 0.9;
    state.camera.position.set(
      target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * Math.cos(elevation) * distance
    );
    state.camera.lookAt(target);
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

type ParticlePianoProps = {
  count: number;
  progress: React.MutableRefObject<PianoProgress>;
  /** Render only while visible, so the loop never runs off-screen. */
  active: boolean;
  /** Called when a key is struck with the pointer. */
  onPlay?: (midi: number, velocity: number) => void;
};

function ParticlePiano({ count, progress, active, onPlay }: ParticlePianoProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 0.1, far: 30, position: [-3, 2, 4] }}
      gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
    >
      <Scene count={count} progress={progress} onPlay={onPlay} />
    </Canvas>
  );
}

export default ParticlePiano;
