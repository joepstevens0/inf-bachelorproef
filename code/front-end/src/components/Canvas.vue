<template>
  <div class="canvas">
    <canvas ref="canvas" :width="width" :height="height"></canvas>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import TexRender from "@/structures/texrender/TexRender";
import Texture from "../structures/webgl/texture";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../constants";

export default Vue.extend({
  name: "Canvas",
  mounted() {
    const canvas = this.$refs.canvas as HTMLCanvasElement;
    this.init(canvas);
  },
  data() {
    return {
      gl: {} as WebGL2RenderingContext,
      width: 0,
      height: 0,
      texRender: null as null | TexRender,
    };
  },
  methods: {
    init(canvasElement: HTMLCanvasElement): void {
      const gl = canvasElement.getContext("webgl2");

      if (!gl) {
        console.error("Failed to initialize WebGL");
        return;
      }
      this.gl = gl;

      this.width = CANVAS_WIDTH;
      this.height = CANVAS_HEIGHT;

      this.texRender = new TexRender(gl);
    },
    getContext(): WebGL2RenderingContext {
      return this.gl;
    },
    getWidth(): number {
      return this.width;
    },
    getHeight(): number {
      return this.height;
    },
    getElement(): HTMLCanvasElement{
      return this.$refs.canvas as HTMLCanvasElement;
    },
    render(texture: Texture, texture2: Texture | null = null) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.getWidth(), this.getHeight());
      this.texRender?.render(texture);

      if (texture2){
        this.gl.viewport(this.getWidth(), 0, this.getWidth(), this.getHeight());
        this.texRender?.render(texture2, [0,0]);
      }
    },
  },
});
</script>

<style scoped>
.canvas {
  padding: 5px;
}
canvas {
  background-color: black;
}
</style>
