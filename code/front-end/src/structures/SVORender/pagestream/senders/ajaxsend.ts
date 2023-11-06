import { BACK_END_PORT, MAX_REQUEST_SIZE } from "../../../../constants";
import { PageData } from "./requester";

const RETRY_TIME = 200;

export default class AjaxSend{

    private _pageSize: number;
    private _onrecv: (data: PageData) => void = (data: PageData) => {return;};

    constructor(pageSize: number){
        this._pageSize = pageSize;
    }

    public open(onready: () => void, onrecv: (data: PageData) => void){
        this._onrecv = onrecv;

        onready();
    }

    public request(requests: number[]){
        if (requests.length > MAX_REQUEST_SIZE){
            this.request(requests.splice(MAX_REQUEST_SIZE));
        }
        try{
            fetch('//localhost:' + BACK_END_PORT + '/xmlhttpreq', {
                method: "POST",
                body: new Uint32Array(requests),
                headers: {
                    "Content-Type": 'application/octet-stream',
                },
            }).then((value: Response)=>{
                value.arrayBuffer().then((data: ArrayBuffer)=>{
                    this.onRecv(requests, data);
                });
            }, (reason: any)=>{
                console.error("Error retreiving page:", reason);
            });
        } catch(e){
            console.error("Error retreiving page:", e);
            setTimeout(()=>{
                this.request(requests);
            } , RETRY_TIME)
        }

    }

    public ready(): boolean{
        return true;
    }

    private onRecv(requests: number[], data: any){
        const view = new DataView(data);

        let i = 0;
        let page = [];
        while (i < view.byteLength){
            page.push(view.getBigUint64(i, true));
    
            i += 8;

            if (page.length >= this._pageSize){
                const pageNumber = requests.shift();
                if (pageNumber != undefined)
                    this._onrecv({pageNumber: pageNumber, data: page});
                page = [];
            }
        }
    }
}