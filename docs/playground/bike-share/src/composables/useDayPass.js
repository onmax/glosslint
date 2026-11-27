import { computed, ref } from "vue";

const PRICE = 6;

export function useDayPass() {
  const riders = ref(1);
  const daypassTotal = computed(() => riders.value * PRICE);
  return { riders, daypassTotal };
}
