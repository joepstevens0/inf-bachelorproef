import { vec2, vec3 } from "gl-matrix";
import Camera from "./camera/camera";

const FREQ = 1000;

export default class Router{

    private _camera: Camera;
    private _startTime = 0;
    private _positions: {time: number; pos: vec3; rot: vec2}[] = [];
    private _lastRoute = "";

    public constructor(camera: Camera){
        this._camera = camera;
    }

    public recordRoute(totalTime: number){
        this._startTime = performance.now();
        const recorder = () =>{
            const time = performance.now() - this._startTime;

            if (time > totalTime){
                this._lastRoute = this.endRecord();
                console.log(this._lastRoute);
                return;
            }

            this.saveCamera(time);
            setTimeout(recorder, FREQ);
        }
        recorder();
    }

    public getRoute(): string{
        return this._lastRoute;
    }
    public endRecord(): string{
        let res = "";
        for (let i = 0; i < this._positions.length;++i){
            res += this._positions[i].time + "|";
            res += this._positions[i].pos[0] + "|";
            res += this._positions[i].pos[1] + "|";
            res += this._positions[i].pos[2] + "|";
            res += this._positions[i].rot[0] + "|";
            res += this._positions[i].rot[1] + "|";
        }
        return res;
    }
    public startRoute(route: string){
        const p = route.split("|");

        this._positions = [];
        for (let i = 0; i < p.length - 6;i += 6){
            this._positions.push({
                time: Number(p[i]),
                pos: vec3.fromValues(Number(p[i+1]), Number(p[i+2]), Number(p[i+3])),
                rot: vec2.fromValues(Number(p[i+4]), Number(p[i+5]))
            });
        }

        this._startTime = performance.now();
        let i = 0;
        const stepper = () =>{
            const time = performance.now() - this._startTime;
            
            const nextTime = this._positions[i+1].time;
            const nextPos = this._positions[i+1].pos;
            const nextRot = this._positions[i+1].rot;
            const perc = (time-this._positions[i].time)/(nextTime-this._positions[i].time);
            const pos = this.interpolateVec3(this._positions[i].pos, nextPos, 1-perc);
            const rot = this.interpolateVec2(this._positions[i].rot, nextRot, 1-perc);

            this._camera.setPos(pos[0],pos[1],pos[2]);
            this._camera.setRot(rot[0],rot[1]);

            if (i < this._positions.length - 1 && this._positions[i+1].time < time){

                i += 1;
            }

            if (i < this._positions.length - 1){
                setTimeout(stepper);
            }
        }
        setTimeout(stepper);
    }

    private interpolateVec3(pos1: vec3, pos2: vec3, perc: number): vec3{
        return vec3.fromValues(
            pos1[0]*perc + pos2[0]*(1-perc),
            pos1[1]*perc + pos2[1]*(1-perc),
            pos1[2]*perc + pos2[2]*(1-perc)
        );
    }

    private interpolateVec2(pos1: vec2, pos2: vec2, perc: number): vec2{
        return vec2.fromValues(
            pos1[0]*perc + pos2[0]*(1-perc),
            pos1[1]*perc + pos2[1]*(1-perc)
        );
    }

    private saveCamera(currentTime: number){
        this._positions.push({time: currentTime, pos: this._camera.getPos(), rot: this._camera.getRotEuler()});
    }
}