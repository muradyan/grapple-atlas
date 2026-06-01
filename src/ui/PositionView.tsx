import { useEffect, useRef } from 'react'
import { nodeById } from '../engine/graph'
import { RollScene, type Pose } from '../three/rollScene'

// Live 3D view of a position. The two grapplers are drawn from GrappleMap's
// 23-joint skeleton (public/gm-poses.json); RED and BLUE are kept consistent
// along a path via `youIsP0` (which canonical player is "red"). When `anim` is
// given, the view morphs from the previous position to this one.

let posesPromise: Promise<Record<number, Pose>> | null = null
const loadPoses = () =>
  (posesPromise ??= fetch('/gm-poses.json')
    .then((r) => r.json())
    .catch(() => ({}) as Record<number, Pose>)) // no poses (e.g. jsdom tests) — render no-ops

let framesPromise: Promise<Record<number, Pose[]>> | null = null
const loadFrames = () =>
  (framesPromise ??= fetch('/gm-frames.json')
    .then((r) => r.json())
    .catch(() => ({}) as Record<number, Pose[]>))

export interface Anim {
  transId: number
  reversed: boolean
  /** CLIP player index that is RED (stable identity) during this clip. */
  redClipIdx: number
}

export default function PositionView({
  node,
  redIdx,
  anim = null,
}: {
  node: number
  redIdx: number
  anim?: Anim | null
}) {
  const n = nodeById(node)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<RollScene | null>(null)
  const posesRef = useRef<Record<number, Pose> | null>(null)
  const framesRef = useRef<Record<number, Pose[]> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new RollScene(canvas)
    sceneRef.current = scene
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scene.resize()) : null
    ro?.observe(canvas)
    let alive = true
    Promise.all([loadPoses(), loadFrames()]).then(([p, f]) => {
      if (!alive) return
      posesRef.current = p
      framesRef.current = f
      if (p[node]) scene.setPose(p[node], redIdx)
    })
    return () => {
      alive = false
      ro?.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render / animate when the position changes.
  useEffect(() => {
    const scene = sceneRef.current
    const poses = posesRef.current
    const frames = framesRef.current
    if (!scene || !poses || !poses[node]) return
    const clip = anim && frames ? frames[anim.transId] : null
    if (anim && clip && clip.length) {
      // RED stays the same athlete (stable identity); the performer may be red or blue.
      scene.animateFrames(clip, anim.redClipIdx, anim.reversed, 1300)
    } else {
      scene.setPose(poses[node], redIdx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, redIdx, anim])

  return (
    <div className="card-surface overflow-hidden">
      {/* shorter, fixed height on mobile (keeps the sticky stage compact); 4:3 on desktop */}
      <div className="relative h-[32vh] w-full bg-mat-900 sm:h-[40vh] lg:h-auto lg:aspect-[4/3]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute left-2 top-2 flex gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          <span className="rounded bg-red-600/85 px-1.5 py-0.5 text-white">Red</span>
          <span className="rounded bg-blue-600/85 px-1.5 py-0.5 text-white">Blue</span>
        </div>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-300">
          drag to rotate · pinch to zoom
        </span>
      </div>
      <div className="px-5 pb-2 pt-2 text-center lg:pb-4 lg:pt-3">
        <h2 className="font-display text-base font-bold capitalize leading-tight tracking-wide text-white lg:text-xl">
          {n.name}
        </h2>
        <p className="mx-auto mt-1 hidden max-w-md text-xs uppercase tracking-wider text-slate-500 sm:block">
          {n.tags.slice(0, 5).join(' · ').replace(/_/g, ' ')}
        </p>
      </div>
    </div>
  )
}
