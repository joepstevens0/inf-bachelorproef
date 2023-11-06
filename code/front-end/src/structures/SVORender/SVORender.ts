import Shader from "../webgl/shader";

import vsSource from "raw-loader!@/shaders/svo/svoshader_it.vs";
import fsSource from "raw-loader!@/shaders/svo/svoshader_it.fs";
import Quad from "../mesh/quad";
import Camera from "../camera/camera";
import SVOCache from "./cache/SVOCache";
import Framebuffer from "../webgl/framebuffer";
import { ptimer } from "../ptimer";
import LRUCollector from "./LRUCollector";
import Texture from "../webgl/texture";
import { BACK_END_PORT, LUT_SIZE, NODE_DATA_POOL_SIZE, PAGESIZE } from "../../constants";


export type RenderOptions ={
    lodLevel: number;
    pixelSizeMult: number;
    rootSize: number;
    cacheUpdateFrame: number;
}

export type RenderInfo = {
    dataPoolSize: number;
    cachePointer: number;
    maxLUTSize: number;
    recvRate: number;
    pageSize: number;
    pagesReceived: number;
    pagesRequested: number;
}
export class SVORender{
    private _gl: WebGL2RenderingContext;
    private _canvasW = 0;
    private _canvasH = 0;
    private _canvas: HTMLCanvasElement;

    private _framebuffer: Framebuffer;
    private _colorTexIndex: number;
    private _requestTexIndex: number;
    private _shader: Shader;
    private _quad: Quad;
    private _camera: Camera;

    private _LRUCol: LRUCollector | null = null;

    private _lutSize = 0;
    private _SVOCache: SVOCache | null = null;
    private _framesSinceCacheUpdate = 0;
    private _framesSinceLRUUpdate = 0;

    private _reqFramePBO: WebGLBuffer | null = null;
    private _reqFrameSync: WebGLSync | null = null;

    public constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, camera: Camera){
        this._gl = gl;
        this._canvas = canvas;
        this._canvasW = canvas.width;
        this._canvasH = canvas.height;
        this._camera = camera;

        // create framebuffer
        this._framebuffer = new Framebuffer(gl, this._canvasW, this._canvasH);
        this._colorTexIndex = this._framebuffer.addColorTex(gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._requestTexIndex = this._framebuffer.addColorTex(gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT);
        this._framebuffer.bind();

        this._shader = new Shader(gl, vsSource, fsSource);
        this._quad = new Quad(gl);

        this.createCache();
    }

    private async createCache(){
        const gl = this._gl;
        
        this._lutSize = LUT_SIZE;
        this._SVOCache = new SVOCache(gl,this._canvasW*this._canvasH, NODE_DATA_POOL_SIZE, this._lutSize, PAGESIZE);

        this._LRUCol = new LRUCollector(gl, this._canvas, this._camera, this._SVOCache);

        this.createPBO(this._SVOCache.requestFrame());
    }

    /**
     * Render the octree to the current framebuffer
     * @post octree is rendered to the currently bound framebuffer
     */
    public render(options: RenderOptions): Texture | null{
        if (this._SVOCache == null) return null;    // cache not yet created

        this._framebuffer.bind();

        this._shader.bind();
        this._gl.viewport(0, 0, this._canvasW, this._canvasH);

        this._SVOCache.bind(this._shader);

        this._camera.bind(this._shader);

        this._shader.bindUniform1ui("uMaxDepth", options.lodLevel);
        this._shader.bindUniform1f("uResolution", options.rootSize);
        this._shader.bindUniform1f("uPixelSize", Math.min(1/this._canvasW, 1/this._canvasH)* options.pixelSizeMult);


        // draw the quad
        const aPosLoc = this._shader.getAttrLocation("aPos");
        const aTexCoordLoc = this._shader.getAttrLocation("aTexCoord");
        this._quad.draw(aPosLoc, aTexCoordLoc);

        this.createRequests();
        if (this._framesSinceCacheUpdate >= options.cacheUpdateFrame){
            this._framesSinceCacheUpdate = 0;
            this.updateCache();
        }
        if (this._framesSinceLRUUpdate >= options.cacheUpdateFrame){
            this._framesSinceLRUUpdate = 0;
            this.updateLRU(options);
        }

        ++this._framesSinceCacheUpdate;
        ++this._framesSinceLRUUpdate;

        return this._framebuffer.getColorTex(this._colorTexIndex);
    }

    public getInfo(): RenderInfo | null{
        if (this._SVOCache == null) return null;
        return{
            dataPoolSize: this._SVOCache.dataPoolSize(),
            maxLUTSize: this._lutSize,
            cachePointer: this._SVOCache.cachePointer(),
            recvRate: this._SVOCache.recvRate(),
            pageSize: this._SVOCache.pageSize(),
            pagesReceived: this._SVOCache.pagesReceived(),
            pagesRequested: this._SVOCache.pagesRequested()
        };
    }

    public clearCache(){
        this.createCache();
    }
    private updateLRU(options: RenderOptions){
        ptimer.startOp("LRU render");
        this._LRUCol?.render(options);
        ptimer.endOp("LRU render");
    }

    private updateCache(){
        ptimer.startOp("Cache update");
        this._SVOCache?.updateCache();
        ptimer.endOp("Cache update");
    }

    private createPBO(reqframe: Uint32Array){
        const gl = this._gl;
        this._reqFramePBO = gl.createBuffer();
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._reqFramePBO);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, reqframe.byteLength, gl.STREAM_READ);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }

    private createRequests(){
        ptimer.startOp("Collect requests");

        const reqframe = (this._SVOCache as SVOCache).requestFrame();

    
        if (Atomics.load(reqframe, 0) > 0){
            // don't write, if not yet read
            return;
        }

        if (this.reqFrameSynced()){
            this.fillReqFramePBO();
        }

        ptimer.endOp("Collect requests");
    }

    private fillReqFramePBO(){
        const gl = this._gl;

        // copy request frame to PBO
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._reqFramePBO);
        gl.readBuffer(gl.COLOR_ATTACHMENT0 + this._requestTexIndex);
        gl.readPixels(0,0,this._canvasW,this._canvasH,gl.RED_INTEGER, gl.UNSIGNED_INT, 0);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        // create sync object
        this._reqFrameSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
    }

    private reqFrameSynced(): boolean{
        const gl = this._gl;
        const reqframe = (this._SVOCache as SVOCache).requestFrame();

        if (this._reqFrameSync != null){

            // check sync object status
            const status = gl.clientWaitSync(this._reqFrameSync, 0, 0);
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
            gl.deleteSync(this._reqFrameSync);
            this._reqFrameSync = null;

            // copy requestframe from PBO to CPU
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._reqFramePBO);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, reqframe);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
            
            // indicate that request frame has been updated
            Atomics.store(reqframe, 0, 1);
        }
        return true;
    }

    private async getLUTSIZE(): Promise<number>{
        try{
            const response = await fetch('//localhost:' + BACK_END_PORT +'/totalPages', {
                method: "GET"
            });
            const totalPages = await response.json();
            return Math.ceil(Math.sqrt(Number(totalPages)))**2 + 1;
        } catch(e){
            console.error("Error retreiving amount of pages: ", e);
            throw e;
        }
    }

}