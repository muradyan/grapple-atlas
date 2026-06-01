// Decode "who controls" per node from real joint geometry.
// Input: scripts/gm-joints.json (from gm-extract-joints.mjs) — per node
// [player0[23][x,y,z], player1[23][x,y,z]], player0=RED=you, player1=BLUE, Y up.
// Output: scripts/p0roles.json = { id: { p0top, conf } } where p0top = "is RED the
// controlling grappler here" and conf = how clear that is (used downstream to
// decide whether a position is truly contested/symmetric).
//
// This REPLACES the old scripts/p0top.json, which decoded control from figure
// HEIGHT (Core.y) only — meaningless on the ground, so it mislabelled back
// control / spider web etc. Here we use height where the players are clearly
// stacked, and fall back to "whose hands are at the opponent's neck" (the
// seatbelt/choke side) when they're level — which correctly catches back control.
import { readFileSync, writeFileSync } from 'fs'

const J = JSON.parse(readFileSync('scripts/gm-joints.json', 'utf8'))

// Joint indices (players.hpp order): hips 8/9, shoulders 10/11, wrists 14/15,
// hands 16/17, Core 20, Neck 21, Head 22.
const HIP = [8, 9], SHO = [10, 11], CORE = 20, NECK = 21, HEAD = 22, HANDS = [14, 15, 16, 17]
const Y = (p, i) => p[i][1]
const torsoY = (p) => (Y(p, HIP[0]) + Y(p, HIP[1]) + Y(p, CORE) + Y(p, SHO[0]) + Y(p, SHO[1])) / 5
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
// closest any of a player's hands/wrists get to the opponent's neck/head
const handToNeck = (att, def) => Math.min(...HANDS.map((h) => Math.min(dist(att[h], def[NECK]), dist(att[h], def[HEAD]))))

// Above this vertical torso gap, the higher player is clearly on top.
const VERT = 0.12

function decode(pos) {
  const [p0, p1] = pos
  const vertSep = torsoY(p0) - torsoY(p1)
  if (Math.abs(vertSep) > VERT) return { p0top: vertSep > 0, conf: Math.abs(vertSep) }
  // Level players: controller = the one attacking the other's neck (seatbelt/choke).
  const a0 = handToNeck(p0, p1) // red's hands -> blue's neck
  const a1 = handToNeck(p1, p0) // blue's hands -> red's neck
  return { p0top: a0 < a1, conf: Math.abs(a1 - a0) }
}

const roles = {}
for (const [id, pos] of Object.entries(J)) {
  const { p0top, conf } = decode(pos)
  roles[id] = { p0top, conf: Math.round(conf * 1000) / 1000 }
}
writeFileSync('scripts/p0roles.json', JSON.stringify(roles))

const vals = Object.values(roles)
console.log(`wrote scripts/p0roles.json for ${vals.length} nodes.`)
const cs = vals.map((v) => v.conf).sort((a, b) => a - b)
console.log(`conf percentiles: p10 ${cs[(cs.length * 0.1) | 0]}, p50 ${cs[(cs.length * 0.5) | 0]}, p90 ${cs[(cs.length * 0.9) | 0]}`)
