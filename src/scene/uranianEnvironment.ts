import * as THREE from "three";

/** One distant environment; no semantic IDs, selection targets, or story causality. */
export function createUranianEnvironment(): { group: THREE.Group; aurora: THREE.ShaderMaterial } {
  const group = new THREE.Group();
  group.name = "environment:uranian-depth";
  const center = new THREE.Vector3(36, -108, -118);
  const surfaceVertex = `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vLocal;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = -mv.xyz;
      vLocal = position;
      gl_Position = projectionMatrix * mv;
    }
  `;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(84, 48, 30), new THREE.ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
      void main() {
        float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 2.2);
        float haze = sin(vLocal.y * 0.075 + sin(vLocal.x * 0.026)) * 0.5 + 0.5;
        vec3 color = mix(vec3(0.019, 0.05, 0.083), vec3(0.065, 0.15, 0.205), rim * 0.65 + haze * 0.06);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }));
  planet.name = "environment:ice-giant";
  planet.position.copy(center);
  group.add(planet);

  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(84.5, 48, 30), new THREE.ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.0);
        gl_FragColor = vec4(0.36, 0.7, 0.83, rim * 0.055);
      }
    `,
    transparent: true, depthWrite: false,
  }));
  atmosphere.position.copy(center);
  group.add(atmosphere);

  const ring = new THREE.Mesh(new THREE.RingGeometry(143, 147, 180, 3, 0.12, Math.PI * 1.9), new THREE.ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 vLocal; varying vec3 vView;
      void main() {
        float r = length(vLocal.xy);
        float edge = smoothstep(143.0, 144.0, r) * (1.0 - smoothstep(146.0, 147.0, r));
        float strata = 0.78 + sin(r * 11.0) * 0.12 + sin(r * 27.0) * 0.06;
        float distanceFade = mix(0.13, 0.025, smoothstep(20.0, 150.0, length(vView)));
        gl_FragColor = vec4(0.32, 0.56, 0.67, edge * strata * distanceFade);
      }
    `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
  }));
  ring.name = "environment:ring-plane";
  ring.position.copy(center);
  ring.rotation.set(0.8, -0.08, -0.1);
  group.add(ring);

  // A bounded curtain uses a single strip, rather than layered full-screen glow.
  const aurora = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(p.x * 0.027 + uTime * 0.018) * 5.0;
        p.z -= p.x * p.x * 0.004;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.76, 1.0, vUv.x));
        float arch = 0.32 + sin(vUv.x * 7.0 + uTime * 0.014) * 0.065;
        float ribbon = exp(-pow((vUv.y - arch) * 7.0, 2.0));
        float curtain = 0.72 + sin(vUv.x * 49.0 + sin(vUv.x * 17.0) + uTime * 0.022) * 0.18;
        vec3 color = mix(vec3(0.18, 0.36, 0.48), vec3(0.42, 0.76, 0.8), vUv.x);
        gl_FragColor = vec4(color, edge * ribbon * curtain * 0.12);
      }
    `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
  });
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(130, 17, 72, 6), aurora);
  curtain.name = "environment:aurora";
  curtain.position.set(12, -6, -100);
  group.add(curtain);
  return { group, aurora };
}
