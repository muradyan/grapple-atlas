import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ---------------------------------------------------------------------------
// Live 3D renderer for the roll. Draws the two grapplers from GrappleMap's
// 23-joint skeleton (poses in `public/gm-poses.json`). "You" are always RED and
// the opponent BLUE — we simply assign the red material to whichever canonical
// player index is currently "you" (`youIsP0`), so colour stays consistent across
// the player-symmetric graph with NO media recolouring. Transitions animate by
// interpolating the from-pose and to-pose (tracking your identity across swaps).
// ---------------------------------------------------------------------------

export type Pose = number[][][] // [player][joint][x,y,z]

// Joint indices (GrappleMap players.hpp order).
const J = {
  LToe: 0, RToe: 1, LHeel: 2, RHeel: 3, LAnkle: 4, RAnkle: 5, LKnee: 6, RKnee: 7,
  LHip: 8, RHip: 9, LSho: 10, RSho: 11, LElb: 12, RElb: 13, LWri: 14, RWri: 15,
  LHand: 16, RHand: 17, LFin: 18, RFin: 19, Core: 20, Neck: 21, Head: 22,
}

// Bones to draw: [jointA, jointB, radius]. Thicker torso, tapering limbs.
// NB: legs start at the HIPS (not Core). The Core→pelvis link is a single spine
// segment drawn separately (to the hip midpoint), plus a pelvis bar LHip↔RHip —
// otherwise the two Core→hip sticks read as leg-tops and legs look too long.
const BONES: [number, number, number][] = [
  [J.Core, J.Neck, 0.07],
  [J.Neck, J.LSho, 0.05], [J.Neck, J.RSho, 0.05],
  [J.LSho, J.LElb, 0.042], [J.LElb, J.LWri, 0.034],
  [J.RSho, J.RElb, 0.042], [J.RElb, J.RWri, 0.034],
  [J.LHip, J.RHip, 0.065], // pelvis bar
  [J.LHip, J.LKnee, 0.055], [J.LKnee, J.LAnkle, 0.044],
  [J.RHip, J.RKnee, 0.055], [J.RKnee, J.RAnkle, 0.044],
  [J.LAnkle, J.LToe, 0.032], [J.RAnkle, J.RToe, 0.032],
]
// Rounded joints (sphere radius) so the figure reads as a body, not a stick.
const JOINT_BALLS: [number, number][] = [
  [J.Core, 0.085], [J.Neck, 0.05],
  [J.LSho, 0.05], [J.RSho, 0.05], [J.LHip, 0.06], [J.RHip, 0.06],
  [J.LElb, 0.042], [J.RElb, 0.042], [J.LKnee, 0.055], [J.RKnee, 0.055],
  [J.LWri, 0.034], [J.RWri, 0.034], [J.LAnkle, 0.044], [J.RAnkle, 0.044],
  [J.LHand, 0.04], [J.RHand, 0.04],
]
const HEAD_R = 0.11

const UP = new THREE.Vector3(0, 1, 0)

/** One grappler: reusable cylinders (bones) + spheres (joints) of one colour. */
class Figure {
  group = new THREE.Group()
  private bones: THREE.Mesh[] = []
  private balls: THREE.Mesh[] = []
  private head: THREE.Mesh
  private spine: THREE.Mesh // Core -> pelvis midpoint (lower trunk)

  constructor(color: number) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 })
    for (const [, , r] of BONES) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat)
      m.castShadow = true
      this.bones.push(m)
      this.group.add(m)
    }
    this.spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 1, 10), mat)
    this.spine.castShadow = true
    this.group.add(this.spine)
    for (const [, r] of JOINT_BALLS) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat)
      m.castShadow = true
      this.balls.push(m)
      this.group.add(m)
    }
    this.head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 16, 12), mat)
    this.head.castShadow = true
    this.group.add(this.head)
  }

  /** Position all meshes from a 23-joint array (already in world space). */
  update(joints: THREE.Vector3[]) {
    BONES.forEach(([a, b], i) => orientBone(this.bones[i], joints[a], joints[b]))
    JOINT_BALLS.forEach(([j], i) => this.balls[i].position.copy(joints[j]))
    this.head.position.copy(joints[J.Head])
    _pelvis.addVectors(joints[J.LHip], joints[J.RHip]).multiplyScalar(0.5)
    orientBone(this.spine, joints[J.Core], _pelvis)
  }
}
const _pelvis = new THREE.Vector3()

const _dir = new THREE.Vector3()
function orientBone(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  _dir.subVectors(b, a)
  const len = _dir.length() || 1e-4
  mesh.position.copy(a).addScaledVector(_dir, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, _dir.normalize())
  mesh.scale.set(1, len, 1)
}

export class RollScene {
  private renderer!: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private you = new Figure(0xd23030) // RED
  private opp = new Figure(0x2f6fed) // BLUE
  private controls: OrbitControls | null = null
  private raf = 0
  private canvas: HTMLCanvasElement
  /** The currently displayed (centred) joints, so a new transition can be aligned
   *  to where we are now for a seamless start. */
  private lastRed: THREE.Vector3[] | null = null
  private lastBlue: THREE.Vector3[] | null = null
  /** False when WebGL is unavailable (e.g. jsdom tests) — methods become no-ops. */
  readonly ok: boolean = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    } catch {
      return // no WebGL — leave ok=false; all methods guard on it
    }
    this.ok = true
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap

    this.scene.background = new THREE.Color(0x0b1120)
    this.scene.fog = new THREE.Fog(0x0b1120, 6, 14)

    this.camera.position.set(2.4, 2.0, 3.4)
    this.camera.lookAt(0, 0.45, 0)

    // Drag (mouse / one finger) to orbit, scroll / pinch to zoom — works on any
    // static position and persists after a transition. No pan; don't dip below the mat.
    const controls = new OrbitControls(this.camera, canvas)
    controls.target.set(0, 0.45, 0)
    controls.enablePan = false
    controls.minDistance = 1.6
    controls.maxDistance = 8
    controls.maxPolarAngle = Math.PI * 0.49
    controls.rotateSpeed = 0.9
    controls.zoomSpeed = 0.9
    controls.addEventListener('change', () => this.render())
    controls.update()
    this.controls = controls

    buildEnvironment(this.scene)
    this.scene.add(this.you.group, this.opp.group)
    this.resize()
  }

  resize() {
    if (!this.ok) return
    const w = this.canvas.clientWidth || 640
    const h = this.canvas.clientHeight || 480
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.render()
  }

  /** Show a static position. `redIdx` = which canonical player is RED ("you"). */
  setPose(pose: Pose, redIdx: number) {
    if (!this.ok) return
    cancelAnimationFrame(this.raf)
    const j = centeredJoints(pose[redIdx], pose[1 - redIdx])
    this.you.update(j.you)
    this.opp.update(j.opp)
    this.lastRed = j.you
    this.lastBlue = j.opp
    this.render()
  }

  /**
   * Play a transition's REAL keyframes (natural motion — no limb interpenetration,
   * unlike a straight endpoint lerp). `youTransIdx` = which of the clip's two players
   * is "you" (red); `reversed` plays the keyframes backwards (escapes). The first
   * frame is rotated to match the currently shown pose so the start is seamless.
   */
  animateFrames(
    frames: Pose[], actorIdx: number, reversed: boolean,
    durationMs: number, onDone?: () => void,
  ) {
    if (!this.ok) return
    cancelAnimationFrame(this.raf)
    const seq = reversed ? frames.slice().reverse() : frames
    const n = seq.length
    if (n === 0) { onDone?.(); return }
    const oppIdx = 1 - actorIdx // RED = the performer (actorIdx); BLUE = the other

    // Rotate the clip's first frame to line up with where we are now. The performer
    // may be the figure currently shown as red OR blue (a perspective switch when
    // the next move is done by the other grappler) — try both correspondences and
    // keep the better fit, so the bodies stay put spatially and only the colour moves.
    let theta = 0
    if (this.lastRed && this.lastBlue) {
      const red0 = seq[0][actorIdx].map(toV)
      const blue0 = seq[0][oppIdx].map(toV)
      const a = bestYRotation([...red0, ...blue0], [...this.lastRed, ...this.lastBlue])
      const b = bestYRotation([...red0, ...blue0], [...this.lastBlue, ...this.lastRed])
      theta = a.residual <= b.residual ? a.theta : b.theta
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const e = t * t * (3 - 2 * t) // smoothstep
      const pos = e * (n - 1)
      const i = Math.floor(pos), f = pos - i, k = Math.min(i + 1, n - 1)
      const red = lerpJoints(seq[i][actorIdx], seq[k][actorIdx], f)
      const blue = lerpJoints(seq[i][oppIdx], seq[k][oppIdx], f)
      if (theta) { rotateYAll(red, theta); rotateYAll(blue, theta) }
      const c = centerPair(red, blue)
      this.you.update(c.you)
      this.opp.update(c.opp)
      this.render()
      if (t < 1) this.raf = requestAnimationFrame(tick)
      else { this.lastRed = c.you; this.lastBlue = c.opp; onDone?.() }
    }
    this.raf = requestAnimationFrame(tick)
  }

  private render() {
    if (!this.ok) return
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.controls?.dispose()
    if (this.ok) this.renderer.dispose()
  }
}

// ---- pose math (raw [x,y,z] arrays -> centred THREE.Vector3 joints) ----
const toV = (p: number[]): THREE.Vector3 => new THREE.Vector3(p[0], p[1], p[2])
function toVecs(j: number[][]): THREE.Vector3[] {
  return j.map(toV)
}
/** Rotate a set of points about the vertical (Y) axis, in place. */
function rotateYAll(vs: THREE.Vector3[], th: number) {
  const c = Math.cos(th), s = Math.sin(th)
  for (const v of vs) { const x = v.x, z = v.z; v.x = x * c - z * s; v.z = x * s + z * c }
}
/** Best Y-rotation mapping `src` onto `dst` (same length + correspondence), in the
 *  x-z plane (2D Procrustes), plus the residual fit error — used to align a clip's
 *  first frame to the current pose and to pick the better player correspondence. */
function bestYRotation(src: THREE.Vector3[], dst: THREE.Vector3[]): { theta: number; residual: number } {
  const n = Math.min(src.length, dst.length)
  let scx = 0, scz = 0, dcx = 0, dcz = 0
  for (let i = 0; i < n; i++) { scx += src[i].x; scz += src[i].z; dcx += dst[i].x; dcz += dst[i].z }
  scx /= n; scz /= n; dcx /= n; dcz /= n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const ax = src[i].x - scx, az = src[i].z - scz, bx = dst[i].x - dcx, bz = dst[i].z - dcz
    num += ax * bz - az * bx
    den += ax * bx + az * bz
  }
  const theta = Math.atan2(num, den)
  const c = Math.cos(theta), s = Math.sin(theta)
  let residual = 0
  for (let i = 0; i < n; i++) {
    const ax = src[i].x - scx, az = src[i].z - scz
    const rx = ax * c - az * s, rz = ax * s + az * c
    const bx = dst[i].x - dcx, bz = dst[i].z - dcz
    residual += (rx - bx) * (rx - bx) + (rz - bz) * (rz - bz)
  }
  return { theta, residual }
}
function lerpJoints(a: number[][], b: number[][], t: number): THREE.Vector3[] {
  return a.map((p, i) => new THREE.Vector3(
    p[0] + (b[i][0] - p[0]) * t,
    p[1] + (b[i][1] - p[1]) * t,
    p[2] + (b[i][2] - p[2]) * t,
  ))
}
/** Centre the pair on the mat: x/z centroid to origin, lowest joint to y=0. */
function centerPair(you: THREE.Vector3[], opp: THREE.Vector3[]) {
  let cx = 0, cz = 0, minY = Infinity
  const all = [...you, ...opp]
  for (const v of all) { cx += v.x; cz += v.z; if (v.y < minY) minY = v.y }
  cx /= all.length; cz /= all.length
  const shift = (vs: THREE.Vector3[]) => vs.map((v) => v.set(v.x - cx, v.y - minY, v.z - cz))
  return { you: shift(you), opp: shift(opp) }
}
function centeredJoints(youRaw: number[][], oppRaw: number[][]) {
  return centerPair(toVecs(youRaw), toVecs(oppRaw))
}

// ---- mat + dojo environment ----
function buildEnvironment(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x202838, 0.85))
  const key = new THREE.DirectionalLight(0xffffff, 1.5)
  key.position.set(3, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.near = 1
  key.shadow.camera.far = 20
  const d = 4
  key.shadow.camera.left = -d; key.shadow.camera.right = d
  key.shadow.camera.top = d; key.shadow.camera.bottom = -d
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x88aaff, 0.4)
  fill.position.set(-4, 3, -2)
  scene.add(fill)

  // gym floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x14182a, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.001
  floor.receiveShadow = true
  scene.add(floor)

  // competition mat
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x2a6b5e, roughness: 0.95 }),
  )
  mat.rotation.x = -Math.PI / 2
  mat.receiveShadow = true
  scene.add(mat)
  // mat border
  const border = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 2.25, 4, 1).rotateZ(Math.PI / 4),
    new THREE.MeshStandardMaterial({ color: 0x1d4d44, roughness: 0.95, side: THREE.DoubleSide }),
  )
  border.rotation.x = -Math.PI / 2
  border.position.y = -0.0005
  border.receiveShadow = true
  scene.add(border)
}
