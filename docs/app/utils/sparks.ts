// Sparks for the hero's torn cable, drawn on a Canvas2D layer the way Canvas UI draws light: hot streaks with
// motion-blurred trails, pulled down by gravity, bouncing once off an implied floor, and a brief flash where they start.
// In dark they add light (`lighter`) with white-hot cores cooling to orange; in light they are saturated orange with a
// dark edge, painted over the pale wall. Positions are in the canvas's CSS px.

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  width: number
  bounces: number
  // The last few positions, oldest first, as x, y pairs: the streak the eye smears behind a fast spark.
  trail: number[]
}

interface Flash { x: number, y: number, radius: number, age: number, life: number, white: boolean }

export interface BurstOptions {
  count: number
  // Direction the spray leans towards, in radians, and how far either side of it a spark can go.
  angle: number
  spread: number
  speed: [number, number]
  life: [number, number]
  width?: number
  flash?: { radius: number, life: number, white?: boolean }
}

const trailLength = 5
const rand = (min: number, max: number) => min + Math.random() * (max - min)
// Bunched towards the middle, like a spray from one point.
const bell = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5

export class SparkField {
  sparks: Spark[] = []
  flashes: Flash[] = []
  gravity = 1400
  floor = Number.POSITIVE_INFINITY
  // The hero clips sideways, so sparks fade out before they reach its edges instead of being cut off there.
  left = Number.NEGATIVE_INFINITY
  right = Number.POSITIVE_INFINITY

  // Read the hero's edges into the canvas's CSS px.
  clipTo(canvas: HTMLElement) {
    const hero = canvas.closest('.glosslint-hero')
    if (!hero) return
    const box = canvas.getBoundingClientRect()
    const edges = hero.getBoundingClientRect()
    this.left = edges.left - box.left
    this.right = edges.right - box.left
  }

  get active() {
    return this.sparks.length > 0 || this.flashes.length > 0
  }

  burst(x: number, y: number, options: BurstOptions) {
    for (let i = 0; i < options.count; i++) {
      const angle = options.angle + bell() * options.spread
      const speed = rand(...options.speed)
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: rand(...options.life),
        width: (options.width ?? 2) * rand(0.7, 1.3),
        bounces: 0,
        trail: [x, y],
      })
    }
    if (options.flash) this.flash(x, y, options.flash)
  }

  flash(x: number, y: number, { radius, life, white = false }: { radius: number, life: number, white?: boolean }) {
    this.flashes.push({ x, y, radius, age: 0, life, white })
  }

  step(dt: number) {
    for (const spark of this.sparks) {
      spark.age += dt
      spark.trail.push(spark.x, spark.y)
      if (spark.trail.length > trailLength * 2) spark.trail.splice(0, 2)
      spark.vy += this.gravity * dt
      spark.vx *= 1 - 1.2 * dt
      spark.x += spark.vx * dt
      spark.y += spark.vy * dt
      // The floor takes most of the speed and some of the heat; a second hit puts the spark out.
      if (spark.y > this.floor && spark.vy > 0) {
        spark.y = this.floor
        spark.vy *= -0.3
        spark.vx *= 0.55
        spark.bounces++
        spark.age += spark.life * (spark.bounces > 1 ? 1 : 0.3)
      }
    }
    this.sparks = this.sparks.filter(spark => spark.age < spark.life)
    for (const flash of this.flashes) flash.age += dt
    this.flashes = this.flashes.filter(flash => flash.age < flash.life)
  }

  // The strongest flash right now, 0 to 1, for whoever lights the cord and the wall with it.
  get light() {
    return this.flashes.reduce((max, flash) => Math.max(max, (1 - flash.age / flash.life) ** 2), 0)
  }

  draw(ctx: CanvasRenderingContext2D, dark: boolean) {
    ctx.save()
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const flash of this.flashes) {
      const a = (1 - flash.age / flash.life) ** 2
      const radius = Math.max(8, Math.min(flash.radius, this.right - flash.x - 2, flash.x - this.left - 2))
      const glow = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius)
      if (dark) {
        glow.addColorStop(0, `rgb(255 255 255 / ${a * (flash.white ? 0.95 : 0.8)})`)
        glow.addColorStop(0.18, `rgb(255 226 170 / ${a * 0.55})`)
        glow.addColorStop(0.5, `rgb(255 138 40 / ${a * 0.16})`)
        glow.addColorStop(1, 'rgb(255 110 20 / 0)')
      }
      else {
        glow.addColorStop(0, `rgb(255 250 235 / ${a * 0.95})`)
        glow.addColorStop(0.16, `rgb(253 186 80 / ${a * 0.7})`)
        glow.addColorStop(0.5, `rgb(249 115 22 / ${a * 0.18})`)
        glow.addColorStop(1, 'rgb(249 115 22 / 0)')
      }
      ctx.fillStyle = glow
      ctx.fillRect(flash.x - radius, flash.y - radius, radius * 2, radius * 2)
    }

    const margin = 36
    for (const spark of this.sparks) {
      const edge = Math.min(1, (spark.x - this.left) / margin, (this.right - spark.x) / margin)
      if (edge <= 0) continue
      const fade = (1 - spark.age / spark.life) * edge
      // Heat: white-hot when thrown, cooling through yellow to orange as it dies.
      const heat = fade ** 0.7
      const tail = spark.trail
      const tx = tail[0]!
      const ty = tail[1]!
      const trace = () => {
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        for (let i = 2; i < tail.length; i += 2) ctx.lineTo(tail[i]!, tail[i + 1]!)
        ctx.lineTo(spark.x, spark.y)
      }
      const streak = (r: number, g: number, b: number, alpha: number, width: number) => {
        const gradient = ctx.createLinearGradient(tx, ty, spark.x, spark.y)
        gradient.addColorStop(0, `rgb(${r} ${g} ${b} / 0)`)
        gradient.addColorStop(1, `rgb(${r} ${g} ${b} / ${alpha})`)
        ctx.strokeStyle = gradient
        ctx.lineWidth = width
        trace()
        ctx.stroke()
      }
      if (dark) {
        streak(255, 90 + 70 * heat, 20, 0.6 * fade, spark.width * 3.6)
        streak(255, 170 + 85 * heat, 70 + 185 * heat, fade, spark.width)
      }
      else {
        // Saturated to the end on a pale wall, then gone.
        const strong = Math.sqrt(fade)
        streak(67, 20, 7, 0.95 * strong, spark.width + 2.4)
        streak(234, 88, 12, strong, spark.width + 0.9)
        streak(255, 190 + 50 * heat, 60 + 100 * heat, strong * heat, spark.width * 0.5)
      }
      // The head, where the spark is hottest.
      ctx.fillStyle = dark ? `rgb(255 ${200 + 55 * heat} ${150 + 105 * heat} / ${fade})` : `rgb(255 ${150 + 70 * heat} 40 / ${Math.sqrt(fade)})`
      ctx.beginPath()
      ctx.arc(spark.x, spark.y, spark.width * 0.75, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}
