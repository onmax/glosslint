<script setup lang="ts">
// One spark where the cable goes back into the board, just before the sign lights. Mount it inside the hero's wall
// (the 800 × 480 box) at `at`, in wall units; it plays once and emits `done`. The hero leaves it out under reduced motion.

const props = defineProps<{ at: [number, number] }>()
const emit = defineEmits<{ done: [] }>()

const canvas = ref<HTMLCanvasElement>()
const size = 240
const style = computed(() => ({ left: `calc(${props.at[0] / 8}% - ${size / 2}px)`, top: `calc(${props.at[1] / 4.8}% - ${size / 2}px)` }))

const field = new SparkField()
let frame = 0
let last = 0

function tick(now: number) {
  const dt = Math.min(1 / 30, (now - last) / 1000)
  last = now
  field.step(dt)
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const ctx = el.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  if (!field.active) return emit('done')
  field.draw(ctx, document.documentElement.classList.contains('dark'))
  frame = requestAnimationFrame(tick)
}

onMounted(() => {
  const el = canvas.value!
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  el.width = el.height = Math.round(size * dpr)
  field.clipTo(el)
  // Up out of the socket on the board's right edge.
  field.burst(size / 2, size / 2, { count: 26, angle: -Math.PI / 2 - 0.3, spread: 1.1, speed: [180, 520], life: [0.2, 0.5], width: 1.5, flash: { radius: 70, life: 0.16, white: true } })
  last = performance.now()
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <canvas ref="canvas" class="gl-spark-pop" :style="style" aria-hidden="true" />
</template>

<style scoped>
.gl-spark-pop {
  position: absolute;
  z-index: 3;
  width: 240px;
  height: 240px;
  pointer-events: none;
}
</style>
