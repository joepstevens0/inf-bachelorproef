<template>
  <div class="PTimerBox">
      Total rendertime: {{result.totalTime.toFixed(2)}}ms
      <hr />
      <div class="operation" v-for="op in ops" :key="op.op"> 
          {{op.op}}
          {{op.time.toFixed(2)}}ms
      </div>
      <br />
      Other: {{other.toFixed(2)}}ms
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { ptimer } from "../structures/ptimer";

export default Vue.extend({
  name: "PTimerBox",
  data() {
    return {
        result: {
            totalTime: 0,
            ops: new Map<string, number>()
        }
    };
  },
  mounted(){
      this.update();
  },
  methods: {
      update(){
          const r = ptimer.getResult();
          this.result.totalTime = r.totalTime;
          this.result.ops = new Map<string, number>(r.ops.entries());
          setTimeout(this.update, 250);
      }
  },
  computed:{
      ops(): {op: string; time: number}[]{
          const ops = [] as {op: string; time: number}[];

          this.result.ops.forEach((value: number, op: string) =>{
              ops.push({op: op, time: value});
          });

          return ops;
      },
      other(): number{
          let other = this.result.totalTime;
          this.result.ops.forEach((value: number, op: string) =>{
              other -= value;
          });
          return other;
      }
  }
});
</script>

<style scoped>
.PTimerBox{
    padding: 10px;
    border: 1px solid black;
    width: fit-content;
    margin: 5px;
    float: left;
    text-align: left;
}
.operation{
    float: left;
    clear: both;
    text-align: left;
    width: 100%;
}
</style>
