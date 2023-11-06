import Shader from "../../webgl/shader";
import CacheTexture from "./CacheTexture";
import RequestWorker from "worker-loader!../worker/request-worker";
import { RecvData, ReqWBufferSetMessage } from "../worker/requestworkertypes";
import Mutex from "../worker/mutex";

export default class SVOCache {

    private _lut: Uint32Array;
    private _dataPool: Uint16Array;
    private _requestFrame: Uint32Array;
    private _LRU: Uint16Array;
    private _pageSize: number;

    private _cacheTex: CacheTexture;

    private _worker: RequestWorker;
    private _recvData: RecvData;



    public constructor(gl: WebGL2RenderingContext, pixels: number, dataPoolSize: number, LUTSize: number, pageSize: number) {
        this._pageSize = pageSize;

        this._cacheTex = new CacheTexture(gl, dataPoolSize, LUTSize, pageSize);

        // create LUT
        const sharedLUT = new SharedArrayBuffer(this._cacheTex.lutSize()*4*3 + 4);
        this._lut = new Uint32Array(sharedLUT).fill(0);

        // create request frame
        const sharedRequestArray = new SharedArrayBuffer(pixels*4 + 4);
        this._requestFrame = new Uint32Array(sharedRequestArray);

        // create data pool
        const sharedDataPoolArray = new SharedArrayBuffer(this._cacheTex.dataPoolSize()*8*pageSize + 2);
        this._dataPool = new Uint16Array(sharedDataPoolArray);

        // create LRU
        const sharedLRUArray = new SharedArrayBuffer(this._cacheTex.dataPoolSize()*2 + 2);
        this._LRU = new Uint16Array(sharedLRUArray).fill(0);

        this._recvData = {
            recvRate: new Float32Array(new SharedArrayBuffer(4)),
            cachePointer: new Uint32Array(new SharedArrayBuffer(4)),
            pagesReceived: new Uint32Array(new SharedArrayBuffer(4)),
            pagesRequested: new Uint32Array(new SharedArrayBuffer(4))
        };

        this._worker = new RequestWorker();
        this.initWorker();
    }

    private initWorker(){
        this._worker.postMessage(
            {
                lut: this._lut, 
                requestFrame: this._requestFrame, 
                dataPool: this._dataPool, 
                LRUMap: this._LRU,
                recvData: this._recvData,
                pageSize: this._pageSize
            } as ReqWBufferSetMessage);
    }

    public recvRate(): number{
        return this._recvData.recvRate[0];
    }

    public requestFrame(): Uint32Array{
        return this._requestFrame;
    }

    public updateCache(){
        Mutex.lock(this._dataPool.buffer);
        Mutex.lock(this._lut.buffer);
        // update cache texture
        this._cacheTex.update(this._lut, this._dataPool);
        Mutex.unlock(this._lut.buffer);
        Mutex.unlock(this._dataPool.buffer);
    }

    public bind(shader: Shader){
        this._cacheTex.bind(shader);
    }

    public cachePointer(): number{
        return this._recvData.cachePointer[0];
    }
    public dataPoolSize(): number{
        return this._cacheTex.dataPoolSize();
    }
    public pageSize(): number{
        return this._pageSize;
    }
    public pagesReceived(): number{
        return this._recvData.pagesReceived[0];
    }
    public pagesRequested(): number{
        return this._recvData.pagesRequested[0];
    }

    public LRUMap(): Uint16Array{
        return this._LRU;
    }
}