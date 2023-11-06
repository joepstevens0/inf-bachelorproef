
const UPDATE_P = 0.02

export default class PTimer{

    private _startTime = 0;

    private _opstartTimes: Map<string, number>;

    private _result = {
        totalTime: 0,
        ops: new Map<string, number>()
    }

    public constructor(){
        this._opstartTimes = new Map<string, number>();
    }

    public getResult(): {
        totalTime: number;
        ops: Map<string, number>;
    }{
        return this._result;
    }
    public startTraject(){
        this._startTime = performance.now();
    }

    public endTraject(){
        const timeDiff = performance.now() - this._startTime;
        this._result.totalTime = (1-UPDATE_P)*this._result.totalTime + UPDATE_P*timeDiff;

        this._result.ops.forEach((value: number, key: string)=>{
            if (this._opstartTimes.has(key)) return;
            this._result.ops.set(key, value*(1-UPDATE_P));
        });
        this._opstartTimes.clear();
    }

    public startOp(opName: string){
        this._opstartTimes.set(opName, performance.now());
    }

    public endOp(opName: string){
        const opTime = performance.now() - (this._opstartTimes.get(opName) as number);
        const val = this._result.ops.get(opName);
        if (val === undefined){
            this._result.ops.set(opName, opTime);
        } else{
            this._result.ops.set(opName, (1-UPDATE_P)*val + UPDATE_P*opTime);
        }
    }
}

export const ptimer = new PTimer();