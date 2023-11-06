<template>
  <div class="Chart">
    <canvas ref="canvas" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import {Chart, ChartConfiguration, ChartDataset, ChartTypeRegistry, registerables } from "chart.js";
import Charter from "../structures/charter";

const STABLEEXTRA = 5;

export default Vue.extend({
  name: 'Chart',
  data(){
    return {
      chart: null as Chart | null,
      colors:[
        'rgb(255, 0, 0)',
        'rgb(0, 255, 0)',
        'rgb(0, 0, 255)',
        'rgb(0, 0, 0)',
        'rgb(255, 255, 0)',
        'rgb(255, 0, 255)',
        'rgb(0, 255, 255)'
      ],
      datasets: [] as ChartDataset<keyof ChartTypeRegistry, (number)[]>[]
    };
  },
  mounted(){

    Chart.register(...registerables);
    const canvas = this.$refs.canvas as any;

    const data = {
      labels: [],
      datasets: [{
        label: '',
        backgroundColor: 'rgb(255, 0, 0)',
        borderColor: 'rgb(255, 0, 0)',
        data: [],
      }]
    };
    Chart.defaults.font.size = 16;
    const config: ChartConfiguration<keyof ChartTypeRegistry, number[], string> = {
      type: 'line',
      data,
      options: {
        elements:{
          point:{
            radius: 2
          }
        },
        plugins:{
          legend:{
            labels:{
              font:{
                size: 18
              }
            }
          }
        }
      }
    };
    this.chart = new Chart(
      canvas,
      config
    );

    const chartUpdater = ()=>{
      const chart = this.chart as Chart | null;
      if (chart != null){
          const chartDatas = Charter.getCharts();
          if (chartDatas[0] != undefined){
            const labels = [...chartDatas[0][1].x];
            this.updateSets(chartDatas);

            chart.config.data.labels = labels;
            chart.config.data.datasets = this.datasets;

            if (this.updateNeeded())
              chart.update();
        }
      }
      setTimeout(chartUpdater, 2000);
    }
    chartUpdater();

  },
  methods: {
    updateSets(chartDatas: [string, {x: any[]; y: number[]}][]): void{
      while (this.datasets.length < chartDatas.length){
        const i = this.datasets.length;
        this.datasets.push({
          label: chartDatas[i][0],
          backgroundColor: this.colors[i % this.colors.length],
          borderColor: this.colors[i % this.colors.length],
          data: chartDatas[i][1].y
        })
      }

      for (let i = 0; i < chartDatas.length;++i){
        this.datasets[i].data = chartDatas[i][1].y;
      }
    },
    updateNeeded(): boolean{
      if (this.datasets.length <= 0) return false;
      if (this.datasets[0].data.length < STABLEEXTRA + 1) return false;
      const p = this.datasets[0].data.length - 1;

      for (let i = 0; i < this.datasets.length;++i){
          for (let j = 1; j < STABLEEXTRA;++j){
            if (this.datasets[i].data[p] != this.datasets[i].data[p-j]){
              return true;
            }
          }
      }

      return false;
    }
  }
});
</script>

<style scoped>
.Chart{
    margin: 30px;
    padding: 50px;
}
canvas{
    background-color: white;
    width: 90%;
}
</style>
