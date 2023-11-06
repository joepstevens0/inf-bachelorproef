import { mat3, mat4, vec2, vec3 } from "gl-matrix"
import { CANVAS_HEIGHT, CANVAS_WIDTH, MOVESPEED, ROTATESPEED } from "../../constants";
import Shader from "../webgl/shader";

export default class Camera {
    private _cameraPos: vec3 = vec3.fromValues(0,0,0);
    private _rot: mat4 = mat4.create();

    private _front: vec3 = vec3.fromValues(0,0,1);
    private _up: vec3 = vec3.fromValues(0,1,0);
    private _right: vec3 = vec3.fromValues(1,0,0);

    private _rotating = false;
    private _lastPos = {x:0, y:0};

    private _movingForward = 0;
    private _movingRight = 0;
    private _movingUp = 0;

    private _xRot = 0;
    private _yRot = 0;
    private _fov = 45;

    private _lastUpdateTime = 0;

    private _canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement){
        this._canvas = canvas;

        const updateFunc = (currentTime: number) =>{
            const modifier  = (currentTime - this._lastUpdateTime)/100;
            this._lastUpdateTime = currentTime;

            vec3.add(this._cameraPos,this._cameraPos, vec3.scale(vec3.create(), this._front, modifier*this._movingForward*MOVESPEED));
            vec3.add(this._cameraPos,this._cameraPos, vec3.scale(vec3.create(), this._right, modifier*this._movingRight*MOVESPEED));
            vec3.add(this._cameraPos,this._cameraPos, vec3.scale(vec3.create(), this._up, modifier*this._movingUp*MOVESPEED));
            requestAnimationFrame(updateFunc);
        }
        updateFunc(0);

        canvas.addEventListener('mousedown', ()=>{
            this._rotating = true;
        });
        canvas.addEventListener('mouseup', ()=>{
            this._rotating = false;
        });
        canvas.addEventListener('mousemove', (evt: MouseEvent) => {
            const mousePos = this.getMousePos(canvas, evt);

            if (this._rotating){
                const xDiff = mousePos.x - this._lastPos.x;
                const yDiff = mousePos.y - this._lastPos.y;

                this._xRot += ROTATESPEED*xDiff;
                this._yRot += ROTATESPEED*yDiff;

                this.updateDirs();
            }
            this._lastPos = mousePos;

          }, false);

        document.addEventListener("keydown", (evt: KeyboardEvent)=>{
            switch (evt.key){
            case "w":
                this._movingForward = 1;
                break;
            case "s":
                this._movingForward = -1;
                break;
            case "a":
                this._movingRight = -1;
                break;
            case "d":
                this._movingRight = 1;
                break;
            case " ":
                this._movingUp = 1;
                evt.preventDefault();
                break;
            case "Shift":
                this._movingUp = -1;
                break;
            }
        });

        document.addEventListener("keyup", (evt: KeyboardEvent)=>{
            switch (evt.key){
            case "w":
                this._movingForward = 0;
                break;
            case "s":
                this._movingForward = 0;
                break;
            case "a":
                this._movingRight = 0;
                break;
            case "d":
                this._movingRight = 0;
                break;
            case " ":
                this._movingUp = 0;
                evt.preventDefault();
                break;
            case "Shift":
                this._movingUp = 0;
                break;
            }
        });
    }

    public setFov(fov: number){
        this._fov = fov;
    }

    public setPos(x: number,y: number,z: number){
        this._cameraPos = vec3.fromValues(x,y,z);
    }
    public setRot(xRot: number, yRot: number){
        this._xRot = xRot;
        this._yRot = yRot;
    }

    private getMousePos(canvas: HTMLCanvasElement, evt: MouseEvent): {x: number; y: number} {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    private toRad(degrees: number): number{
        return degrees* (Math.PI/180);
    }

    /**
     * Bind the uniform camera values of a shader
     * @param shader changing uniforms from 
     * @post shader camera uniforms are now the values of this camera
     */
    public bind(shader: Shader){
        shader.bindUniformVec3("uCamera.pos", this.getPos());
        shader.bindUniformMat3("uCamera.rot",  this.getRot());
        shader.bindUniform1f("uCamera.fov",  this._fov);

        shader.bindUniformMat4("uCamera.view",  this.getView());
        shader.bindUniformMat4("uCamera.proj",  this.getProj());
    }

    /**
     * Get the position of the camera
     * @returns vec3 containing the position of the camera
     */
    public getPos(): vec3{
        return vec3.copy(vec3.create(),this._cameraPos);
    }

    private getView(): mat4{
        const view = mat4.create();
        mat4.translate(view, view, vec3.mul(vec3.create(),this.getPos(), vec3.fromValues(-1,-1,1)));

        const xrot = mat4.fromRotation(mat4.create(), this.toRad(this._xRot), vec3.fromValues(0,1,0));
        mat4.mul(view, xrot, view);
        const yrot = mat4.fromRotation(mat4.create(), this.toRad(this._yRot), vec3.fromValues(1,0,0));
        mat4.mul(view, yrot, view);
        return view;
    }
    private getProj(): mat4{
        const proj = mat4.create();
        mat4.perspective(proj, this.toRad(this._fov), CANVAS_WIDTH/CANVAS_HEIGHT, 0.1, 1000);
        return proj;
    }

    private updateDirs()
    {
        const xRot = this.toRad(this._xRot);
        this._front[0] = Math.sin(xRot);
        this._front[1] = 0;
        this._front[2] = Math.cos(xRot);

        vec3.normalize(this._right, vec3.cross(vec3.create(), this._up, this._front));

    }

    /**
     * Get the rotation matrix for the camera
     * @returns mat3 containing rotation matrix for the camera
     */
    public getRot(): mat3 {
        const xRad = this.toRad(this._xRot);
        const yRad = this.toRad(this._yRot);

        mat4.fromRotation(this._rot, xRad, vec3.fromValues(0,1,0));
        mat4.rotateX(this._rot, this._rot, yRad);

        return mat3.fromMat4(mat3.create(),this._rot);

    }

    public getRotEuler(): vec2{
        return vec2.fromValues(this._xRot, this._yRot);
    }
}