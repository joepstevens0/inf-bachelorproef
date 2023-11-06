


export default class Charter{
    private static _values = new Map<string, {x: any[]; y: number[]}>();

    public static addValue(chartName: string, x: any, y: number){
        const oldVal = this._values.get(chartName);

        if (oldVal == undefined){
            this._values.set(chartName, {x:[x], y:[y]});
        }else{
            oldVal.x.push(x);
            oldVal.y.push(y);
            this._values.set(chartName, oldVal);
        }
    }

    public static getCharts(): [string, {x: any[]; y: number[]}][]{
        return [...this._values.entries()];
    }

    public static getChartValueString(chartname: string): string
    {
        const values = this._values.get(chartname);
        if (values == undefined) return "";

        let result = "";
        for (let i = 0; i < values.x.length;++i){
            result += values.x[i] + "|" + values.y[i] + "_"; 
        }
        return result;
    }

    public static parseString(chartname: string, data: string){
        const p = data.split("_");

        let lastTime = 0;
        for (let i = 0; i < p.length-1;++i){
            const time = parseFloat(p[i].split("|")[0]);
            const d = parseFloat(p[i].split("|")[1]);
            while (time >= lastTime){
                this.addValue(chartname, lastTime.toFixed(0), d);
                lastTime += 0.5;
            }
        }
    }
}