import { BACK_END_PORT, MAX_REQUEST_SIZE } from "../../../../constants";
import { PageData } from "./requester";

export default class WebSocketSend{
    private _ws: WebSocket | null = null;
    private _pageSize: number;
    private _onrecv: (data: PageData) => void = (data: PageData) => {return;};
    private _inflightbuffer = [] as number[];
    private _recvBuffer = [] as bigint[];

    constructor(pageSize: number){
        this._pageSize = pageSize;
    }

    public open(onready: () => void, onrecv: (data: PageData) => void){
        this._onrecv = onrecv;

        // open the websocket
        this._ws = new WebSocket("ws://localhost:" + BACK_END_PORT + "/websocket");
        this._ws.binaryType = 'arraybuffer';

        this._ws.onopen = () => {
            console.debug("Connection opened with back-end");
            onready();
        };
        
        this._ws.onmessage = (message: any) => {
            const data = message.data as ArrayBuffer;
            this.onRecv(data);
        }
    }

    public request(requests: number[]){
        if (requests.length > MAX_REQUEST_SIZE){
            this.request(requests.splice(MAX_REQUEST_SIZE));
        }
        
        this._inflightbuffer.push(...requests);
        this._ws?.send(new Uint32Array(requests));
    }

    public ready(): boolean{
        if (this._ws == null) return false;
        return this._ws.readyState == this._ws.OPEN;
    }


    private onRecv(data: any){
        const view = new DataView(data);

        let i = 0;
        let page = this._recvBuffer;
        while (i < view.byteLength){
            page.push(view.getBigUint64(i, true));
    
            i += 8;

            if (page.length >= this._pageSize){
                const pageNumber = this._inflightbuffer.shift();
                if (pageNumber != undefined)
                    this._onrecv({pageNumber: pageNumber, data: page});
                page = [];
            }
        }
        this._recvBuffer = page;
    }

}