import { ptimer } from "../../ptimer";
import { MAX_INFLIGHT } from "../../../constants";
import { LUTFind } from "../LUToperations";
import Mutex from "../worker/mutex";
import { RecvData } from "../worker/requestworkertypes";
import Requester, { PageData } from "./senders/requester";

const INFLIGHT_NUMBER = 2;
const NOREQUEST_NUMBER = 0;

export default class PageRequester{
    private _requester: Requester;
    private _onload: (page: PageData) => void;

    private _lut: Uint32Array;
    private _requestFrame: Uint32Array;

    private _requestMap: Uint8Array;
    private _requestBuffer = new Map<number, number>();
    private _inFlight = 0;
    

    private _recvData: RecvData;

    constructor(lut: Uint32Array, requestFrame: Uint32Array, pageSize: number, onLoad: (page: PageData) => void, recvData: RecvData){
        this._onload = onLoad;
        this._lut = lut;
        this._requestMap = new Uint8Array(lut.length);
        this._requestFrame = requestFrame;
        this._recvData = recvData;

        const onready = () => {
            this.requestRoot();
        };
        const loadPage = (page: PageData) => {
            // remove in-flight bit for the page
            this._requestMap[page.pageNumber] = NOREQUEST_NUMBER;
            this._recvData.pagesReceived[0] += 1;

            this._inFlight -= 1;
    
            this._onload(page);
        }

        this._requester = new Requester(pageSize);
        this._requester.open(onready, loadPage);

    }

    private _avgTime = 0;
    private _timePrint = 60;
    public update(){
        ptimer.startTraject();
        this.parseFrame();
        this.sendRequests();
        ptimer.endTraject();

        // this._avgTime = (this._avgTime + ptimer.getResult().totalTime)/2;

        // if (this._timePrint <= 0){
        //     console.log("Request send time:" , this._avgTime);
        //     this._timePrint = 60;
        // }
        // this._timePrint -= 1;
    }

    /**
     * Parse the request frame, sending requests for needed pages
     */
    private parseFrame(): void{
        // request frame not yet updated
        if (Atomics.load(this._requestFrame, 0) <= 0) return;

        //  fill map with requests
        for (let i = 1; i < this._requestFrame.length;++i){
            const request = Atomics.load(this._requestFrame, i);
    
            this.addReq(request);
        }
        Atomics.store(this._requestFrame, 0, 0);
    }

    /**
     * create a request for a page
     * @param pagePointer: pointer for the page requesting
     * @post if page not in cache or already requested, request for the page is added to the requestbuffer
     */
    private addReq(pagePointer: number){
    
        if (pagePointer == 0){ 
            // root is always in the cache, 0 means pixel does not request a page
            return;
        }

        Mutex.lock(this._lut.buffer);
        const lutVal = LUTFind(this._lut, pagePointer);
        Mutex.unlock(this._lut.buffer);
        if (lutVal > 0){
            // request already in cache
            return;
        }

        if (this._requestMap[pagePointer] == INFLIGHT_NUMBER){
            // request is in-flight
            return;
        }

        // test is already in requestbuffer
        const mapVal = this._requestBuffer.get(pagePointer);
        if (mapVal != undefined){
            // already in requestbuffer, increase priority
            this._requestBuffer.set(pagePointer, mapVal + 1);
        } else{
            // not yet in the requestbuffer
            this._requestBuffer.set(pagePointer, 1);
        }
        this._requestMap[pagePointer] = INFLIGHT_NUMBER;
    }
    
    private sendRequests(){
        // can't send when socket not open
        if (!this._requester.ready()) return;
        if (this._inFlight > MAX_INFLIGHT) return;
    
        // sort requests by priority
        const entries = Array.from(this._requestBuffer.entries());
        // entries.sort((a: [number, number], b: [number, number]) => a[1]-b[1]);

        // transform to 1D array by removing priority
        const pagePointers = [] as number[];
        entries.forEach((value: [number, number]) => {
            pagePointers.push(value[0]);
        });
    
        if (pagePointers.length > 0){
            // send requests
            this._requester.request(pagePointers);

            // update total pages requested
            this._recvData.pagesRequested[0] += entries.length;
            this._inFlight += entries.length;

            
            // clear requestbuffer
            this._requestBuffer.clear();
        }
    }

    private requestRoot(){
        this._requester.request([0]);

        // update total pages requested
        this._recvData.pagesRequested[0] += 1;
    }
}