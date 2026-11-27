<script setup>
// The checkout screen, where a customer buys a Day Pass.
import { useDayPass } from "../composables/useDayPass.js";

const { riders, daypassTotal } = useDayPass();
</script>

<template>
  <section class="checkout">
    <h2>Buy a day pass</h2>
    <p>Ride any E-Bike for 24 hours.</p>
    <label>
      Riders
      <input v-model.number="riders" type="number" min="1" />
    </label>
    <button type="button">Pay €{{ daypassTotal }}</button>
    <p class="hint">Leave the bike at a rack when you are done.</p>
  </section>
</template>
