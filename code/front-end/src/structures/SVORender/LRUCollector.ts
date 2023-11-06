import Framebuffer from "../webgl/framebuffer";
import Shader from "../webgl/shader";

import vsSource from "raw-loader!@/shaders/svo/LRUscatter.vs";
import fsSource from "raw-loader!@/shaders/svo/LRUscatter.fs";
import Camera from "../camera/camera";
import SVOCache from "./cache/SVOCache";
import { RenderOptions } from "./SVORender";
import Texture from "../webgl/texture";
import Mutex from "./worker/mutex";
import {LRU_DENSITY, LRU_TOTAL_RENDER_PER_TIME, MAX_LRU_DEPTH} from "../../constants";


export default class LRUCollector{
    private _gl: WebGL2RenderingContext;
    private _canvasW = 0;
    private _canvasH = 0;
    private _shader: Shader;
    private _framebuffer: Framebuffer;
    private _mapTexIndex: number;
    private _vertexBuffer: WebGLBuffer | null = null;

    private _mapW: number;
    private _mapH: number;
    private _map: Uint16Array;
    private _mapPBO: WebGLBuffer | null = null;
    private _mapSync: WebGLSync | null = null;
    private _drawSync: WebGLSync | null = null;

    private _cache: SVOCache;
    private _camera: Camera;

    private _readTex: Texture;
    private _currentFrame = 1;
    private _rendersLeft = 0;

    public constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, camera: Camera, cache: SVOCache){
        this._gl = gl;
        this._canvasW = canvas.width;
        this._canvasH = canvas.height;
        this._cache = cache;
        this._camera = camera;

        this._mapW = Math.floor(Math.sqrt(cache.dataPoolSize()));
        this._mapH = this._mapW;

        // create framebuffer
        this._framebuffer = new Framebuffer(gl, this._mapW, this._mapH);
        this._mapTexIndex = this._framebuffer.addColorTex(gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT);

        this._shader = new Shader(gl, vsSource, fsSource);

        this.createVertexBuffer();

        this._map = this._cache.LRUMap();
        this._map[0] = 1;
        this._readTex = new Texture(gl, this._mapW, this._mapH, gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT);

        this.createMapPBO();
    }

    /**
     * Update the LRU map in 1 render
     * @param options for the render
     * @post if this was the last render needed to update the LRU map, LRU map is updated
     */
    public render(options: RenderOptions){
        const gl = this._gl;

        if (!this.drawDone()) return;
        
        this.draw(options);

        // update map
        if (this.mapSynced()){
            this.fillMapPBO();
        }

        this._rendersLeft -= 1;
        if (this._rendersLeft <= 0){
            this._currentFrame += 1;
            this._rendersLeft = LRU_TOTAL_RENDER_PER_TIME;
        }

        if (this._currentFrame >= (2**16) - 1) this._currentFrame = 1;
    }

    /**
     * Bind the shader for the given options
     * @param options for the shader
     * @post shader is bound for options <options>
     */
    private bindshader(options: RenderOptions){
        this._shader.bind();
        this._cache.bind(this._shader);
        this._camera.bind(this._shader);
        this._shader.bindUniform1ui("uMapWidth", this._mapW);
        this._shader.bindUniform1ui("uMapHeight", this._mapH);
        this._shader.bindUniform1ui("uMaxDepth", options.lodLevel);
        this._shader.bindUniform1f("uResolution", options.rootSize);
        this._shader.bindUniform1f("uPixelSize", Math.min(1/this._canvasW, 1/this._canvasH)* options.pixelSizeMult);
        this._shader.bindUniform1i("uLRUMap", 3);
        this._readTex.bind(3);

        this._shader.bindUniform1ui("uTimeStamp", Math.floor(this._currentFrame));
    }

    private draw(options: RenderOptions){
        const gl = this._gl;

        this._framebuffer.bind();
        this.bindshader(options);
        gl.viewport(0, 0, this._mapW, this._mapH);

        // bind vertex array
        const aPosLoc = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
        gl.vertexAttribPointer(
            aPosLoc,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(aPosLoc);

        // draw points
        gl.drawArrays(gl.POINTS, 0, this._canvasW*this._canvasH*MAX_LRU_DEPTH);

        // create sync object
        this._drawSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
    }

    private createVertexBuffer(){
        // create vertexbuffer
        this._vertexBuffer = this._gl.createBuffer();
        if (!this._vertexBuffer) {
            console.error("Failed to create request collector vertex buffer");
            throw "Failed to create request collector vertex buffer";
        }

        // fill vertex buffer
        const pixelNumbers = new Float32Array(3*this._canvasW*this._canvasH*MAX_LRU_DEPTH);
        for(let y = 0; y < this._canvasH;y += LRU_DENSITY){
            for (let x = 0; x < this._canvasW;x += LRU_DENSITY){
                for (let z = 0; z < MAX_LRU_DEPTH;z += LRU_DENSITY){
                    const pos = x*3 + 3*this._canvasW*y + z*3*this._canvasW*this._canvasH;
                    pixelNumbers[pos] = x/this._canvasW;
                    pixelNumbers[pos + 1] = y/this._canvasH;
                    pixelNumbers[pos + 2] = z;
                }
            }
        }
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._vertexBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, pixelNumbers, this._gl.STATIC_DRAW);
    }

    private drawDone(): boolean{
        const gl = this._gl;

        if (this._drawSync != null){
            // check sync object status
            const status = gl.clientWaitSync(this._drawSync, 0, 0);
            switch (status) {
                case gl.TIMEOUT_EXPIRED:
                    // not yet done
                    return false;
                case gl.WAIT_FAILED:
                    console.error("Failed to wait on sync");
                    break;
                default:
                    break;
            }
            // sync is done, delete sync object
            gl.deleteSync(this._drawSync);
            this._drawSync = null;

            // update LRU read map texture
            this._framebuffer.bind();
            this._readTex.bind(0);
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.R16UI, 0,0,this._mapW, this._mapH, 0);
        }

        return true;
    }

    private mapSynced(): boolean{
        const gl = this._gl;

        if (this._mapSync != null){
            // check sync object status
            const status = gl.clientWaitSync(this._mapSync, 0, 0);
            switch (status) {
                case gl.TIMEOUT_EXPIRED:
                    // not yet done
                    return false;
                case gl.WAIT_FAILED:
                    console.error("Failed to wait on sync");
                    break;
                default:
                    break;
            }
            // sync is done, delete sync object
            gl.deleteSync(this._mapSync);
            this._mapSync = null;

            // copy map from PBO to CPU map
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._mapPBO);
            Mutex.lock(this._map.buffer);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this._map);
            Mutex.unlock(this._map.buffer);

            // unbind PBO
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);


        }

        return true;
    }

    private fillMapPBO(){
        const gl = this._gl;

        // copy map in GPU to PBO
        this._framebuffer.bind();
        gl.readBuffer(gl.COLOR_ATTACHMENT0 + this._mapTexIndex);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._mapPBO);
        gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
        gl.readPixels(0,0,this._mapW,this._mapH,gl.RED_INTEGER, gl.UNSIGNED_SHORT, 0);

        // unbind PBO
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        // create sync object
        this._mapSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
    }

    private createMapPBO(){
        const gl = this._gl;

        this._mapPBO = gl.createBuffer();
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._mapPBO);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, this._map.byteLength, gl.STREAM_READ);

        // unbind PBO
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }
}