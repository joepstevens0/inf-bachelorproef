<template>
  <div class="RenderInfoBox">
    <div>Cache size: {{ info.dataPoolSize }} pages ({{dataPoolSize}})</div>
    <div>LUT size: {{ info.maxLUTSize }} pages ({{lutSize}})</div>
    <div>Page size: {{info.pageSize}} nodes</div>
    <div>Cachepointer: {{ fillPerc }}% ({{pointerSize}})</div>
    <div>Recv rate: {{ recvRate }}</div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { RenderInfo } from "../structures/SVORender/SVORender";

export default Vue.extend({
  name: "RenderInfoBox",
  props:{
      info: {}
  },
  data() {
    return {

    };
  },
  methods: {
      bytesToString(bytes: number): string{
        if (bytes > 1000000){
            return (bytes/1000000).toFixed(2) + " MB";
        } else if (bytes > 1000){
            return (bytes/1000).toFixed(2) + " kB";
        }else {
            return bytes + " Bytes";
        }
      },
  },
  computed:{
      fillPerc(): string{
          const inf = this.info as RenderInfo;
          const n = inf.cachePointer/inf.dataPoolSize;
          return (100*n).toFixed(2);
      },
      pointerSize(): string{
          const bytes = (this.info as RenderInfo).cachePointer*8*(this.info as RenderInfo).pageSize;
          return this.bytesToString(bytes);
      },
      recvRate(): string{
          const inf = this.info as RenderInfo;
          if (inf.recvRate == undefined) return "-";
          if (inf.recvRate > 1000000){
              return (inf.recvRate/1000000).toFixed(2) + " MB/s";
          } else if(inf.recvRate > 1000){
              return (inf.recvRate/1000).toFixed(2) + " kB/s";
          }else {
              return (inf.recvRate).toFixed(2) + " Bytes/s";
          }
      },
      dataPoolSize(): string{
          const bytes = (this.info as RenderInfo).dataPoolSize*8*(this.info as RenderInfo).pageSize;
          return this.bytesToString(bytes);
      },
      lutSize(): string{
          const bytes = (this.info as RenderInfo).maxLUTSize*4*3;
          return this.bytesToString(bytes);
      }
  }
});
</script>

<style scoped>
.RenderInfoBox{
    padding: 10px;
    border: 1px solid black;
    width: fit-content;
    margin: 5px;
    float: left;
}
</style>
