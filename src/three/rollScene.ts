import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

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

// Limb bones, drawn as muscle-tapered cylinders: [jointA, jointB, radiusA, radiusB].
// The fleshy trunk (chest / abdomen / pelvis) is built from oriented volumes below
// instead of sticks, so the figure reads as a body rather than a skeleton.
const BONES: [number, number, number, number][] = [
  [J.Neck, J.LSho, 0.035, 0.046], [J.Neck, J.RSho, 0.035, 0.046], // clavicles
  [J.LSho, J.LElb, 0.05, 0.038], [J.LElb, J.LWri, 0.038, 0.028], // left arm
  [J.RSho, J.RElb, 0.05, 0.038], [J.RElb, J.RWri, 0.038, 0.028], // right arm
  [J.Neck, J.Head, 0.052, 0.046], // neck
  [J.LHip, J.LKnee, 0.082, 0.058], [J.LKnee, J.LAnkle, 0.058, 0.036], // left leg
  [J.RHip, J.RKnee, 0.082, 0.058], [J.RKnee, J.RAnkle, 0.058, 0.036], // right leg
  [J.LAnkle, J.LToe, 0.036, 0.03], [J.LAnkle, J.LHeel, 0.036, 0.03], // left foot
  [J.RAnkle, J.RToe, 0.036, 0.03], [J.RAnkle, J.RHeel, 0.036, 0.03], // right foot
]
// Rounded joints (sphere radius) so limbs flow smoothly through elbows/knees/etc.
const JOINT_BALLS: [number, number][] = [
  [J.LSho, 0.052], [J.RSho, 0.052],
  [J.LElb, 0.04], [J.RElb, 0.04], [J.LWri, 0.03], [J.RWri, 0.03],
  [J.LKnee, 0.06], [J.RKnee, 0.06], [J.LAnkle, 0.043], [J.RAnkle, 0.043],
  [J.LHand, 0.046], [J.RHand, 0.046], // hands (fist-sized)
  [J.LToe, 0.03], [J.RToe, 0.03], [J.LHeel, 0.03], [J.RHeel, 0.03],
]
const HEAD_R = 0.12

const UP = new THREE.Vector3(0, 1, 0)

/**
 * One grappler with a fleshed-out body: muscle-tapered limbs (cylinders),
 * rounded joints (spheres), a head + neck, and oriented trunk volumes
 * (chest, abdomen, pelvis) plus a dark BJJ belt — all driven each frame from
 * the 23-joint skeleton.
 */
class Figure {
  group = new THREE.Group()
  private bones: THREE.Mesh[] = []
  private balls: THREE.Mesh[] = []
  private head: THREE.Mesh
  private chest: THREE.Mesh
  private abdomen: THREE.Mesh
  private pelvis: THREE.Mesh
  private belt: THREE.Mesh

  constructor(color: number) {
    const skin = new THREE.MeshStandardMaterial({
      color, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.9,
    })
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x15171c, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.6,
    })

    for (const [, , rA, rB] of BONES) {
      // +Y of the cylinder points to joint B (see orientBone), so top radius = rB.
      // Joint spheres of matching radius cap each end → seamless capsule limbs.
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, 1, 16), skin)
      m.castShadow = true
      this.bones.push(m)
      this.group.add(m)
    }
    for (const [, r] of JOINT_BALLS) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), skin)
      m.castShadow = true
      this.balls.push(m)
      this.group.add(m)
    }
    this.head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 24, 18), skin)
    this.head.scale.set(0.92, 1.08, 0.96) // slightly egg-shaped
    this.head.castShadow = true
    this.group.add(this.head)

    // Trunk volumes: unit cylinders (radius 0.5, height 1) scaled per frame into
    // ellipsoidal blocks — rounder than boxes, and the flat caps tuck under the
    // shoulders / pelvis. The belt is a thin dark band at the waist.
    const trunk = () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), skin)
      m.castShadow = true
      this.group.add(m)
      return m
    }
    this.chest = trunk()
    this.abdomen = trunk()
    this.pelvis = trunk()
    this.belt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), beltMat)
    this.belt.castShadow = true
    this.group.add(this.belt)
  }

  /** Position all meshes from a 23-joint array (already in world space). */
  update(j: THREE.Vector3[]) {
    BONES.forEach(([a, b], i) => orientBone(this.bones[i], j[a], j[b]))
    JOINT_BALLS.forEach(([k], i) => this.balls[i].position.copy(j[k]))

    const core = j[J.Core]
    const sMid = _sMid.addVectors(j[J.LSho], j[J.RSho]).multiplyScalar(0.5)
    const hMid = _hMid.addVectors(j[J.LHip], j[J.RHip]).multiplyScalar(0.5)
    const shoulderSpan = j[J.LSho].distanceTo(j[J.RSho])
    const hipSpan = j[J.LHip].distanceTo(j[J.RHip])

    // head: sit it on the neck and tilt it along Neck→Head
    _yd.subVectors(j[J.Head], j[J.Neck])
    if (_yd.lengthSq() > 1e-9) this.head.quaternion.setFromUnitVectors(UP, _yd.normalize())
    this.head.position.copy(j[J.Head])

    // chest: shoulder line → core, as wide as the shoulders
    _c.addVectors(sMid, core).multiplyScalar(0.5)
    _yd.subVectors(sMid, core)
    _xr.subVectors(j[J.RSho], j[J.LSho])
    orientPart(this.chest, _c, _yd, Math.max(_yd.length(), 0.06), _xr, Math.max(shoulderSpan * 1.05, 0.2), 0.19)

    // abdomen: core → hips
    _c.addVectors(core, hMid).multiplyScalar(0.5)
    _yd.subVectors(core, hMid)
    _xr.subVectors(j[J.RHip], j[J.LHip])
    orientPart(this.abdomen, _c, _yd, Math.max(_yd.length(), 0.06), _xr, Math.max(hipSpan * 1.05, 0.17), 0.17)

    // pelvis: a rounded block spanning the hips (long axis = hip-to-hip)
    _xr.subVectors(core, hMid) // vertical reference
    _yd.subVectors(j[J.RHip], j[J.LHip])
    orientPart(this.pelvis, hMid, _yd, Math.max(hipSpan * 1.1, 0.12), _xr, 0.2, 0.18)

    // belt: thin dark band just above the hips
    _c.copy(hMid).addScaledVector(_xr, 0.16) // _xr still = core - hMid (toward the torso)
    _yd.subVectors(j[J.RHip], j[J.LHip])
    _xr.subVectors(core, hMid)
    orientPart(this.belt, _c, _yd, Math.max(hipSpan * 1.18, 0.14), _xr, 0.07, 0.21)
  }
}
const _sMid = new THREE.Vector3()
const _hMid = new THREE.Vector3()
const _c = new THREE.Vector3()
const _yd = new THREE.Vector3()
const _xr = new THREE.Vector3()
const _bx = new THREE.Vector3()
const _by = new THREE.Vector3()
const _bz = new THREE.Vector3()
const _m4 = new THREE.Matrix4()

/**
 * Orient & scale a unit body part (cylinder height 1, radius 0.5, centred) into an
 * ellipsoidal block: `center` = world position, `yDir`/`yLen` = long axis + length,
 * `xRef` = the lateral direction (orthogonalised against yDir), `width`/`depth` =
 * the two cross-section diameters.
 */
function orientPart(
  mesh: THREE.Mesh, center: THREE.Vector3, yDir: THREE.Vector3, yLen: number,
  xRef: THREE.Vector3, width: number, depth: number,
) {
  _by.copy(yDir)
  if (_by.lengthSq() < 1e-9) _by.set(0, 1, 0)
  _by.normalize()
  _bx.copy(xRef).addScaledVector(_by, -xRef.dot(_by)) // orthogonalise against unit _by
  if (_bx.lengthSq() < 1e-9) _bx.set(1, 0, 0).addScaledVector(_by, -_by.x)
  _bx.normalize()
  _bz.crossVectors(_bx, _by).normalize()
  _bx.crossVectors(_by, _bz).normalize() // re-orthonormalise
  _m4.makeBasis(_bx, _by, _bz)
  mesh.quaternion.setFromRotationMatrix(_m4)
  mesh.position.copy(center)
  mesh.scale.set(width, yLen, depth)
}

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap // softer shadow edges
    // Filmic tone mapping → realistic highlight roll-off instead of flat, blown-out colour.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.72

    this.scene.background = new THREE.Color(0x0b1120)
    this.scene.fog = new THREE.Fog(0x0b1120, 6, 14)

    // Image-based lighting: a procedural studio environment (no asset download) feeds
    // soft, directional ambient into every MeshStandardMaterial — the single biggest
    // jump in how "real" the skin/mat read, with no runtime fetch.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

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
  // Env map carries the ambient now, so the hemisphere light is just a gentle tint.
  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x202838, 0.25))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(3, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.radius = 4 // soft (PCFSoft) edges
  key.shadow.bias = -0.0004
  key.shadow.camera.near = 1
  key.shadow.camera.far = 20
  const d = 4
  key.shadow.camera.left = -d; key.shadow.camera.right = d
  key.shadow.camera.top = d; key.shadow.camera.bottom = -d
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x88aaff, 0.25)
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
