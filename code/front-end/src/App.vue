<template>
  <div id="app">
    <SVOViewer />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import SVOViewer from './components/SVOViewer.vue';

export default Vue.extend({
  name: 'App',
  components: {
    SVOViewer
  }
});
</script>

<style>
body{
  margin: 0px;
  background-color: #333333;
}
#app {
  margin: 0px;
  padding: 0px;
}
</style>
