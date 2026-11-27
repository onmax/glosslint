<script setup>
import CheckoutCard from "./components/CheckoutCard.vue";
import { t } from "./i18n.js";
</script>

<template>
  <main class="app">
    <h1>Bike share</h1>
    <p>{{ t("ride.start") }}</p>
    <CheckoutCard />
    <p>{{ t("ride.end") }}</p>
  </main>
</template>
