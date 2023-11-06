<template>
  <div class="SVOViewer">
    <Canvas ref="canvas" />
    <FPSCounter ref="fps"></FPSCounter>
    <RenderOptionsBox ref="options" :camera="camera" />
    <div class="compareBox">
      <div class="compareButton" v-on:click="compareImgs">Compare</div>
      <br />
      <label class="compareLabel">MSE: {{ MSE.toFixed(4) }}</label>
      <label class="compareLabel">PSNR: {{ PSNR.toFixed(4) }}</label>
      <label class="compareLabel">SSIM: {{ SSIM.toFixed(4) }}</label>
    </div>
    <PTimerBox />
    <RenderInfoBox :info="SVOinfo" />
    <button v-on:click="startRoute">Start route</button>
    <button v-on:click="recordRoute">Record route</button>
    <button v-on:click="clearCache">Clear cache</button>
    <Chart />
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import Canvas from "./Canvas.vue";
import FPSCounter from "./FPSCounter.vue";
import RenderOptionsBox from "./RenderOptionsBox.vue";
import RenderInfoBox from "./RenderInfoBox.vue";
import PTimerBox from "./PTimerBox.vue";
import { RenderInfo, SVORender } from "../structures/SVORender/SVORender";
import { MeshRender } from "../structures/mesh/MeshRender";
import Camera from "../structures/camera/camera";
import ssim from "ssim.js";
import { ptimer } from "../structures/ptimer";
import Texture from "../structures/webgl/texture";
import Router from "../structures/router";
import Chart from "./Chart.vue";
import Charter from "../structures/charter";
import { CAMERA_START_POS, CAMERA_START_ROT, ROUTE_DATA } from "../constants";

export default Vue.extend({
  name: "SVOViewer",
  data() {
    return {
      init: false,
      svoRender: null as SVORender | null,
      meshRender: null as MeshRender | null,
      camera: null as Camera | null,
      showMesh: false,
      MSE: 0 as number,
      PSNR: 0 as number,
      SSIM: 0 as number,
      SVOinfo: {} as RenderInfo,
    };
  },
  mounted() {
    const canvas = this.$refs.canvas as any;
    this.camera = new Camera(canvas.getElement());

    // set start position
    this.camera.setPos(CAMERA_START_POS[0],CAMERA_START_POS[1],CAMERA_START_POS[2]);
    this.camera.setRot(CAMERA_START_ROT[0], CAMERA_START_ROT[1]);

    // start rendering
    requestAnimationFrame(this.render);

    // bind button to render switch
    document.addEventListener("keypress", (evt: KeyboardEvent) => {
      switch (evt.key) {
        case "q":
          this.showMesh = !this.showMesh;
          break;
      }
    });

    this.init = true;

    // start the render info updater
    const infoUpdater = () => {
      if (this.svoRender != null) {
        const info = this.svoRender.getInfo();
        if (info != null) this.SVOinfo = info;
      }
      setTimeout(infoUpdater, 250);
    };
    infoUpdater();

    // start the chart updater
    this.startRecvCharter();
    //this.startRoute();
  },
  methods: {
    render() {
      ptimer.startTraject();

      // update camera Fov
      this.camera?.setFov((this.$refs.options as any).getFov());

      // create a texture from the chosen renderer
      let tex;
      if (this.showMesh) {
        tex = this.getMeshTex();
      } else {
        tex = this.getSVOTex();
      }

      // render the texture to the canvas
      if (tex != null) (this.$refs.canvas as any).render(tex);

      // update fps counter
      (this.$refs.fps as any).updateCounter();

      requestAnimationFrame(this.render);
      ptimer.endTraject();
    },
    getMeshTex(): WebGLTexture {
      // create mesh render if null
      if (this.meshRender == null) {
        const canvas = this.$refs.canvas as any;
        const gl = canvas.getContext();
        this.meshRender = new MeshRender(
          gl,
          canvas.getElement(),
          this.camera as Camera
        );
      }

      // return completed texture by mesh renderer
      return this.meshRender.render(
        (this.$refs.options as any).getRootSize()
      ) as WebGLTexture;
    },
    getSVOTex(): Texture | null {
      // create svo render if null
      if (this.svoRender == null) {
        const canvas = this.$refs.canvas as any;
        const gl = canvas.getContext();
        this.svoRender = new SVORender(
          gl,
          canvas.getElement(),
          this.camera as Camera
        );
      }

      // return completed texture by mesh render
      const renderOptions = (this.$refs.options as any).getOptions();
      return (this.svoRender as SVORender).render(renderOptions);
    },
    
    compareImgs() {
      const canvas = this.$refs.canvas as any;
      const gl = canvas.getContext() as WebGL2RenderingContext;
      const h = canvas.getHeight();
      const w = canvas.getWidth();
      const meshTex = this.getMeshTex();
      const svoTex = this.getSVOTex();
      const meshPixels = new Uint8ClampedArray(w * h * 4);
      const svoPixels = new Uint8ClampedArray(w * h * 4);

      // fill pixels arrays
      canvas.render(meshTex);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, meshPixels);
      canvas.render(svoTex);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, svoPixels);

      // update MSE
      const mse = this.calcMSE(meshPixels, svoPixels);
      this.MSE = mse;

      // update PSNR
      this.PSNR = this.calcPSNR(mse);

      // update SSIM
      this.SSIM = this.calcSSIM(meshPixels, svoPixels, w, h);
    },

    calcMSE(
      meshPixels: Uint8ClampedArray,
      svoPixels: Uint8ClampedArray
    ): number {
      let mse = 0;
      for (let i = 0; i < meshPixels.length; i += 1) {
        mse += (meshPixels[i] - svoPixels[i]) ** 2 / meshPixels.length;
      }
      return mse;
    },
    calcPSNR(mse: number): number {
      return 20 * Math.log10(255) - 10 * Math.log10(mse);
    },
    calcSSIM(
      meshPixels: Uint8ClampedArray,
      svoPixels: Uint8ClampedArray,
      width: number,
      height: number
    ) {
      const meshImage = new ImageData(meshPixels, width, height);
      const svoImage = new ImageData(svoPixels, width, height);
      const { mssim } = ssim(meshImage, svoImage, {
        k1: 0.01,
        k2: 0.03,
      });
      return mssim;
    },

    startRoute() {
      const router = new Router(this.camera as Camera);
      router.startRoute(
        ROUTE_DATA
      );
    },
    recordRoute() {
      const router = new Router(this.camera as Camera);
      router.recordRoute(45000);
    },
    startSSIMCharter(){
      const startTime = performance.now();
      // start the chart updater
      const chartUpdater = (time: number) => {
        //this.compareImgs();
        Charter.addValue("test", time.toFixed(1), (this.SVOinfo as RenderInfo).recvRate);
  
        if (time < 45.1)
          setTimeout(chartUpdater, 100, (performance.now()-startTime)/1000);
      };
      setTimeout(chartUpdater, 1000, 0);
    },
    startRecvCharter(){
      const chartUpdater = (time: number) => {
        const inf = this.SVOinfo as RenderInfo;
        Charter.addValue("Pages requested", time.toFixed(1), inf.pagesRequested);
        Charter.addValue("Pages received", time.toFixed(1), inf.pagesReceived);
        setTimeout(chartUpdater, 100, time + 0.1);
      };
      chartUpdater(0);
    },
    clearCache(){
      this.svoRender?.clearCache();
    }

    // calcSSIM(meshPixels: Uint32Array, svoPixels: Uint32Array): number{
    //   let avgSVO = 0;
    //   let avgMesh = 0;
    //   let total = 0;
    //   for (let i = 0; i < svoPixels.length;i += 1){
    //     // ignore transparent pixels
    //     if ((meshPixels[i] & 255) <= 0 && (svoPixels[i] & 255) <= 0){
    //       continue;
    //     }
    //     total += 1;
    //     avgSVO += svoPixels[i] >>> 8;
    //     avgMesh += meshPixels[i] >>> 8;
    //   }
    //   avgSVO = avgSVO/total;
    //   avgMesh = avgMesh/total;

    //   let varSVO = 0;
    //   let varMesh = 0;
    //   let covar = 0;
    //   for (let i = 0; i < svoPixels.length;i += 1){
    //     // ignore transparent pixels
    //     if ((meshPixels[i] & 255) <= 0 && (svoPixels[i] & 255) <= 0){
    //       continue;
    //     }
    //     varSVO += ((svoPixels[i] >>> 8) - avgSVO)**2;
    //     varMesh += ((meshPixels[i] >>> 8) - avgMesh)**2;
    //     covar += ((svoPixels[i] >>> 8) - avgSVO)*((meshPixels[i] >>> 8) - avgMesh);
    //   }
    //   varSVO = varSVO/total;
    //   varMesh = varMesh/total;
    //   covar = covar/total;

    //   const L = (2**24) - 1;
    //   const k1 = 0.01;
    //   const k2 = 0.03;
    //   const c1 = (k1*L)**2;
    //   const c2 = (k2*L)**2;

    //   const SSIMtop = (2*avgSVO*avgMesh + c1)*(2*covar + c2);
    //   const SSIMbottom = ((avgSVO**2) + (avgMesh**2) + c1) * ((varSVO**2) + (varMesh**2) + c2);
    //   return SSIMtop/SSIMbottom;
    // }
  },
  components: {
    Canvas,
    FPSCounter,
    RenderInfoBox,
    RenderOptionsBox,
    PTimerBox,
    Chart,
  },
});
</script>

<style scoped>
.SVOViewer {
  width: 100%;
  height: 100vh;
  background-color: #333333;
  text-align: center;
  color: #aaaaaa;
}

.compareBox {
  border: 1px solid black;
  width: fit-content;
  margin: 5px;
  padding: 10px;
  float: left;
}

.compareLabel {
  padding: 5px;
  float: left;
  clear: both;
}

.compareButton {
  margin: 5px;
  background-color: #444444;
  width: 100px;
  margin: auto;
  padding: 10px;
}
.compareButton:hover {
  background-color: #777777;
  cursor: pointer;
}
</style>
