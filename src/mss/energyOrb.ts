import * as THREE from "three";

const CORE_RADIUS = 2.3;

// Facing the camera keeps the optical falloff round while the center still
// projects from a fixed point in the same depth-tested world as the mountain.
const glowVertex = /* glsl */ `
  varying vec2 orbUv;
  uniform float extent;
  void main() {
    orbUv = position.xy * extent;
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    center.xy += orbUv;
    gl_Position = projectionMatrix * center;
  }
`;

const glowFragment = /* glsl */ `
  varying vec2 orbUv;
  uniform float radius;
  uniform float pulse;
  uniform float reveal;
  uniform vec3 ice;
  uniform vec3 cyan;
  uniform vec3 blue;

  void main() {
    vec2 p = orbUv / radius;
    float r = length(p);
    float direction = atan(p.y, p.x + .00001);
    float skewedRadius = r * (1.0 + .043 * cos(3.0 * direction + .7));
    float spread = 1.0 + .12 * pulse + .17 * reveal;
    float airyCore = exp(-pow(skewedRadius / (.61 * spread), 2.0));
    float innerHalo = exp(-pow(skewedRadius / (1.16 * spread), 2.0));
    float outerHalo = exp(-pow(skewedRadius / (1.9 * spread), 2.0));
    float clouds = .83 + .17 * sin(p.x * 3.4 + p.y * 2.2 + 1.2 * cos(p.y * 3.5));
    float softEnvelope = airyCore * .47 * clouds + innerHalo * .21 + outerHalo * .10;
    float alpha = softEnvelope * (.92 + .08 * pulse);
    vec3 color = mix(blue, cyan, clamp(innerHalo * 1.15, 0.0, 1.0));
    color = mix(color, ice, airyCore * .71);

    // A single low-contrast front spreads away from the anchor during reveal.
    float edge = mix(.86, 4.0, reveal);
    float distanceFromFront = (skewedRadius - edge) / (.19 + reveal * .17);
    float ribbon = exp(-distanceFromFront * distanceFromFront);
    float sweep = sin(reveal * 3.14159265) * ribbon * (.65 + .35 * cos(direction - .65));
    color = mix(color, cyan, sweep * .8);
    alpha += sweep * .30;
    alpha *= 1.0 - smoothstep(.83, 1.0, max(abs(p.x), abs(p.y)) / (3.1 + 2.0 * reveal));
    if (alpha < .004) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

const filamentVertex = /* glsl */ `
  attribute vec3 filamentColor;
  attribute float filamentAlpha;
  varying vec3 streamColor;
  varying float streamAlpha;
  void main() {
    streamColor = filamentColor;
    streamAlpha = filamentAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const filamentFragment = /* glsl */ `
  uniform float energy;
  varying vec3 streamColor;
  varying float streamAlpha;
  void main() {
    gl_FragColor = vec4(streamColor, streamAlpha * energy);
    #include <colorspace_fragment>
  }
`;

function createFilamentGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], alphas: number[] = [];
  const threads = [
    { start: -.66, arc: 4.23, radius: .82, tilt: .57, yaw: -.26, roll: .35, color: "#c6f9ff" },
    { start: 1.24, arc: 4.56, radius: .76, tilt: -.62, yaw: .46, roll: -.41, color: "#258bf2" },
    { start: 2.18, arc: 3.8, radius: .95, tilt: .98, yaw: .62, roll: .78, color: "#71e8ff" },
    { start: -1.88, arc: 3.25, radius: .57, tilt: .81, yaw: -.5, roll: 1.6, color: "#aaf6ff" },
    { start: 1.36, arc: 2.3, radius: 1.16, tilt: -.72, yaw: -.22, roll: 1.08, color: "#488eff" },
  ];
  const segments = 36;
  const axis = new THREE.Vector3();
  const hue = new THREE.Color();
  for (const [index, thread] of threads.entries()) {
    hue.set(thread.color);
    const rotation = new THREE.Euler(thread.tilt, thread.yaw, thread.roll);
    const addVertex = (u: number): void => {
      const angle = thread.start + u * thread.arc;
      const bend = .88 + .11 * Math.sin(2.3 * angle + index) + .07 * Math.cos(4 * angle);
      const length = CORE_RADIUS * thread.radius * bend;
      axis.set(length * Math.cos(angle), length * Math.sin(angle), .19 * CORE_RADIUS * Math.sin(angle * 2.6 + index));
      axis.applyEuler(rotation);
      positions.push(axis.x, axis.y, axis.z);
      colors.push(hue.r, hue.g, hue.b);
      alphas.push(.88 * Math.sin(u * Math.PI) ** 1.25);
    };
    for (let segment = 0; segment < segments; segment++) {
      addVertex(segment / segments);
      addVertex((segment + 1) / segments);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("filamentColor", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("filamentAlpha", new THREE.Float32BufferAttribute(alphas, 1));
  return geometry;
}

/** World-space authored cue with no timer, data source, light, or texture. */
export class MssEnergyOrb {
  readonly group = new THREE.Group();
  readonly anchor = this.group.position;
  private readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly filaments: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor() {
    this.group.name = "MSS · workspace invitation";
    this.anchor.set(22, 38.5, -60);
    const glowMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        extent: { value: CORE_RADIUS * 3.1 },
        radius: { value: CORE_RADIUS },
        pulse: { value: 0 },
        reveal: { value: 0 },
        ice: { value: new THREE.Color("#dcfcff") },
        cyan: { value: new THREE.Color("#4ecfff") },
        blue: { value: new THREE.Color("#276fec") },
      },
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMaterial);
    this.glow.frustumCulled = false; // The billboard grows in the vertex shader.
    this.glow.renderOrder = 4;
    const filamentMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { energy: { value: .82 } },
      vertexShader: filamentVertex,
      fragmentShader: filamentFragment,
    });
    this.filaments = new THREE.LineSegments(createFilamentGeometry(), filamentMaterial);
    this.filaments.renderOrder = 5;
    this.group.add(this.glow, this.filaments);
  }

  /** Both channels are unit intervals supplied by the owning renderer pass. */
  update(reveal: number, pulse: number): void {
    const t = THREE.MathUtils.clamp(reveal, 0, 1);
    const p = THREE.MathUtils.clamp(pulse, 0, 1);
    const { uniforms } = this.glow.material;
    uniforms.reveal.value = t;
    uniforms.pulse.value = p;
    uniforms.extent.value = CORE_RADIUS * (3.1 + 2 * t);
    this.filaments.scale.setScalar(1 + p * .07 + t * .27);
    this.filaments.material.uniforms.energy.value = .82 + .10 * p - .30 * t;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    this.filaments.geometry.dispose();
    this.filaments.material.dispose();
  }
}
