<template>
  <div class="FPSCounter">FPS:{{ fpscounter }}</div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "FPSCounter",
  data() {
    return {
      fpscounter: 0,
      times: [] as number[],
    };
  },
  methods: {
    updateCounter() {
      const now = performance.now();

      // remove times older then a second
      while (this.times.length > 0 && this.times[0] <= now - 1000) {
        this.times.shift();
      }
      // add current time
      this.times.push(now);

      // update fps counter
      this.fpscounter = this.times.length;
    },
  },
});
</script>

<style scoped>
.FPSCounter {
  color: white;
  padding: 0px;
}
</style>
