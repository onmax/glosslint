// Sparks for the hero's torn cable, drawn on a Canvas2D layer the way Canvas UI draws light: hot streaks with
// motion-blurred trails, pulled down by gravity, cooling and going out as they fall, and a brief flash where they start.
// In dark they add light (`lighter`) with white-hot cores cooling to orange; in light they keep a white-hot core inside
// a thin orange body and a dark edge, so they read as fire on the pale wall. Positions are in the canvas's CSS px.

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  width: number
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
  // Sparks fade out before they reach these edges instead of being cut off there: the hero's sides, which clip, and
  // the canvas's own top and bottom. There is no floor to land on, so a spark goes out in the air as it cools.
  left = Number.NEGATIVE_INFINITY
  right = Number.POSITIVE_INFINITY
  top = Number.NEGATIVE_INFINITY
  bottom = Number.POSITIVE_INFINITY

  // Read the hero's sides and the canvas's height into the canvas's CSS px.
  clipTo(canvas: HTMLElement) {
    const box = canvas.getBoundingClientRect()
    this.top = 0
    this.bottom = box.height
    const hero = canvas.closest('.glosslint-hero')
    if (!hero) return
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
    // Falling sparks cool over a longer stretch than the sides cut them.
    const fall = 70
    for (const spark of this.sparks) {
      const edge = Math.min(1, (spark.x - this.left) / margin, (this.right - spark.x) / margin, (spark.y - this.top) / margin, (this.bottom - spark.y) / fall)
      if (edge <= 0) continue
      const fade = (1 - spark.age / spark.life) * edge
      // Heat: white-hot when thrown, cooling through yellow to orange as it dies.
      const heat = fade ** 0.7
      if (dark) {
        const tail = spark.trail
        const tx = tail[0]!
        const ty = tail[1]!
        const streak = (r: number, g: number, b: number, alpha: number, width: number) => {
          const gradient = ctx.createLinearGradient(tx, ty, spark.x, spark.y)
          gradient.addColorStop(0, `rgb(${r} ${g} ${b} / 0)`)
          gradient.addColorStop(1, `rgb(${r} ${g} ${b} / ${alpha})`)
          ctx.strokeStyle = gradient
          ctx.lineWidth = width
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          for (let i = 2; i < tail.length; i += 2) ctx.lineTo(tail[i]!, tail[i + 1]!)
          ctx.lineTo(spark.x, spark.y)
          ctx.stroke()
        }
        streak(255, 90 + 70 * heat, 20, 0.6 * fade, spark.width * 3.6)
        streak(255, 170 + 85 * heat, 70 + 185 * heat, fade, spark.width)
        // The head, where the spark is hottest.
        ctx.fillStyle = `rgb(255 ${200 + 55 * heat} ${150 + 105 * heat} / ${fade})`
        ctx.beginPath()
        ctx.arc(spark.x, spark.y, spark.width * 0.75, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      // On a pale wall a long smear reads as rain, so the streak is a short dash behind the head, its length set by the
      // speed: a dark edge that holds it against the wall, a saturated orange body, and a white-yellow core that cools.
      const strong = Math.sqrt(fade)
      const speed = Math.hypot(spark.vx, spark.vy) || 1
      const length = Math.min(16, 4 + speed * 0.016)
      const bx = spark.x - spark.vx / speed * length
      const by = spark.y - spark.vy / speed * length
      const w = spark.width * 0.6
      const dash = (color: string, alpha: number, width: number, from: number) => {
        const gradient = ctx.createLinearGradient(bx, by, spark.x, spark.y)
        gradient.addColorStop(from, `rgb(${color} / 0)`)
        gradient.addColorStop(1, `rgb(${color} / ${alpha})`)
        ctx.strokeStyle = gradient
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(spark.x, spark.y)
        ctx.stroke()
      }
      dash('110 34 0', 0.6 * strong, w + 1.6, 0)
      dash(`255 ${100 + 50 * heat} 0`, strong, w + 0.6, 0)
      dash(`255 ${240 + 15 * heat} ${170 + 85 * heat}`, strong * (0.5 + 0.5 * heat), w * 0.7, 0.3)
      // The head: a white-hot point inside a thin dark edge.
      ctx.fillStyle = `rgb(110 34 0 / ${0.6 * strong})`
      ctx.beginPath()
      ctx.arc(spark.x, spark.y, w * 0.8 + 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgb(255 ${235 + 20 * heat} ${160 + 95 * heat} / ${strong})`
      ctx.beginPath()
      ctx.arc(spark.x, spark.y, w * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}
