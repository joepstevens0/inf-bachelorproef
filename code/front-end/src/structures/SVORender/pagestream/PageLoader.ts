import { LRU_TRESH } from "../../../constants";
import { LUTAdd, LUTFind, LUTRemove } from "../LUToperations";
import Mutex from "../worker/mutex";
import { RecvData } from "../worker/requestworkertypes";
import { PageData } from "./senders/requester";

export default class PageLoader{

    private _dataPool: Uint16Array;
    private _lut: Uint32Array;
    private _LRUMap: Uint16Array;
    private _pageSize: number;
    private _dataPoolSize: number;

    private _reverseLUT = [] as number[];
    private _cachePointer = 1;

    private _waitingForRoot = true;
    private _newData = 0;
    private _recvData: RecvData;

    private _currentFrame = 0;

    constructor(dataPool: Uint16Array, lut: Uint32Array, LRUMap: Uint16Array, pageSize: number, recvData: RecvData){
        this._dataPool = dataPool;
        this._lut = lut;
        this._LRUMap = LRUMap;
        this._pageSize = pageSize;
        this._recvData = recvData;
        this._dataPoolSize = ((this._dataPool.length-1)/4)/this._pageSize;
        this._reverseLUT = new Array<number>(this._dataPoolSize).fill(0);

        const recvRateUpdater =  () => {
            this._recvData.recvRate[0] = this._recvData.recvRate[0]*0.8 + this._newData*0.2;
            this._recvData.cachePointer[0] = this._cachePointer;
            this._newData = 0;
            setTimeout(recvRateUpdater, 200);
        }
        recvRateUpdater();
    }

    public loadPage(page: PageData) {
        // update amount of received data
        this._newData += 8*this._pageSize;
        
        // load root on first load
        if (this._waitingForRoot){
            this.loadRoot(page.data);
            this._waitingForRoot = false;
            return;
        }

        // add the page
        this.addPage(page.pageNumber, page.data);

    }

    private addPage(pointer: number, page: bigint[]){

        // test if page already in cache
        Mutex.lock(this._lut.buffer);
        const lutVal = LUTFind(this._lut, pointer);
        Mutex.unlock(this._lut.buffer);
        if (lutVal > 0) return;

        // make space in cache
        const cacheIndex = this.makeCacheSpace();
        if (cacheIndex == 0) return;

        // add page to data pool and update lookup table for page
        this.setCacheEl(pointer, cacheIndex, page);

        // update reverseLUT for cache position
        this._reverseLUT[cacheIndex] = pointer;

        // set LRU value for new page so it doesn't get replaced immidiately
        Atomics.store(this._LRUMap, cacheIndex, this._currentFrame);
    }

    /**
     * Make space for a page in the cache
     * @returns a pointer in the cache for an unused space or 0 if unable to make space
     */
    private makeCacheSpace(): number{
        let i = (this._cachePointer + 1)% (this._dataPoolSize); // resume from last search

        while (i != this._cachePointer){ // loop max 1 time through the LRUmap
            if (i != 0){
                Mutex.lock(this._LRUMap.buffer);
                const lru = Atomics.load(this._LRUMap, i);
                Mutex.unlock(this._LRUMap.buffer);
                if (lru == 0 || Math.abs(this._currentFrame - lru) > LRU_TRESH){
                    // element was not used, element can be replaced
                    break;
                }
            }
            i = (i + 1) % this._dataPoolSize;
        } 

        // return if none found
        if (this._cachePointer == i) return 0;

        // update cache pointer
        this._cachePointer = i;

        // remove the old element
        if (this._reverseLUT[i] > 0){
            Mutex.lock(this._lut.buffer);
            LUTRemove(this._lut, this._reverseLUT[i]);
            Mutex.unlock(this._lut.buffer);
        }

        return i;
    }

    private loadRoot(page: bigint[]){
        this.setCacheEl(0,0,page);
    }

    private setCacheEl(pagePointer: number, cachePointer: number, page: bigint[]){
        Mutex.lock(this._dataPool.buffer);
        Mutex.lock(this._lut.buffer);

        LUTAdd(this._lut, pagePointer, cachePointer);
        this.setDataPool(cachePointer, page);

        Mutex.unlock(this._lut.buffer);
        Mutex.unlock(this._dataPool.buffer);
    }

    /**
     * Updates a value in the cache
     * @param cacheIndex: position in the cache
     * @param page: new value for the index
     * @post Data pool value on position <cacheIndex> is changed to <page>
     */
    private setDataPool(cacheIndex: number, page: bigint[]){
        let p = cacheIndex*this._pageSize;

        for (let i = 0; i < this._pageSize;++i){
            const value = page[i];

            Atomics.store(this._dataPool, 4*p, Number((value >> 48n)& 0xFFFFn));
            Atomics.store(this._dataPool, 4*p + 1, Number((value >> 32n)& 0xFFFFn));
            Atomics.store(this._dataPool, 4*p + 2, Number((value >> 16n)& 0xFFFFn));
            Atomics.store(this._dataPool, 4*p + 3, Number(value & 0xFFFFn));

            p += 1;
        }

    }
}