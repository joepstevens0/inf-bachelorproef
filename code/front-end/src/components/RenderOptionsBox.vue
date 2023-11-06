<template>
  <div class="RenderOptions">
    <label>LODLevel:</label>
    <input
      type="range"
      min="0"
      max="11"
      v-model="sliderVal"
      class="slider"
      :ref="sliderVal"
    />
    <input type="number" v-model="sliderVal" ref="lodText" />
    <br />
    <label>PixelSize:</label>
    <input
      type="range"
      :min="0"
      :max="50"
      step="1"
      v-model="pixelSizeMult"
      class="slider"
      :ref="pixelSizeMult"
    />
    <input type="number" v-model="pixelSizeMult" />
    <br />
    <label>RootSize:</label>
    <input
      type="range"
      :min="1"
      :max="20"
      step="1"
      v-model="rootSize"
      class="slider"
      :ref="rootSize"
    />
    <input type="number" v-model="rootSize" />
    <br />
    <label>Cache update frame:</label>
    <input
      type="range"
      :min="0"
      :max="60"
      step="1"
      v-model="cacheUpdateFrame"
      class="slider"
      :ref="cacheUpdateFrame"
    />
    <input type="number" v-model="cacheUpdateFrame" />
    <br />
    <label>Fov:</label>
    <input type="number" v-model="fov" />
    <br />
    <label>Cam pos:</label>
    <input type="number" v-model="xPos" />
    <input type="number" v-model="yPos" />
    <input type="number" v-model="zPos" />
    <br />
    <label>Cam rot:</label>
    <input type="number" v-model="xRot" />
    <input type="number" v-model="yRot" />
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import Camera from "../structures/camera/camera";
import { RenderOptions } from "../structures/SVORender/SVORender";

export default Vue.extend({
  name: "RenderOptionsBox",
  props:{
      camera: Camera
  },
  data() {
    return {
      sliderVal: 11,
      pixelSizeMult: 1,
      rootSize: 10,
      cacheUpdateFrame: 4,
      fov: 45,
      xPos: 0,
      yPos: 0,
      zPos: 0,
      xRot: 0, 
      yRot: 0
    };
  },
  methods: {
    getOptions(): RenderOptions {
      const renderOptions = {} as RenderOptions;
      renderOptions.lodLevel = this.sliderVal;
      renderOptions.pixelSizeMult = this.pixelSizeMult;
      renderOptions.rootSize = this.rootSize;
      renderOptions.cacheUpdateFrame = this.cacheUpdateFrame;
      return renderOptions;
    },
    getFov(): number{
      return this.fov;
    },
    getRootSize(): number{
      return this.rootSize;
    },
    updateCam(){
      (this.camera as Camera).setPos(this.xPos,this.yPos,this.zPos);
      (this.camera as Camera).setRot(this.xRot,this.yRot);
    }
  },    
  watch: {
    xPos: function (newVal, oldVal) {
      this.updateCam();
    },
    yPos: function (newVal, oldVal) {
      this.updateCam();
    },
    zPos: function (newVal, oldVal) {
      this.updateCam();
    },
    xRot: function (newVal, oldVal) {
      this.updateCam();
    },
    yRot: function (newVal, oldVal) {
      this.updateCam();
    },
  }
});
</script>

<style scoped>
.RenderOptions {
  padding: 10px;
  border: 1px solid black;
  width: fit-content;
  margin: 5px;
  float: left;
}
</style>
