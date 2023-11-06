import WebSocketSend from "./websocketsend";
import AjaxSend from "./ajaxsend";
import { SendType, SENDTYPE } from "../../../../constants";


export type PageData = {
    pageNumber: number;
    data: bigint[];
};

export default class Requester{
    private _ws: WebSocketSend | null = null;
    private _ajax: AjaxSend | null = null;

    constructor(pageSize: number){

        switch(SENDTYPE){
            case SendType.websocket:
                this._ws = new WebSocketSend(pageSize);
                break;
            case SendType.ajax:
                this._ajax = new AjaxSend(pageSize);
                break;
        }
    }

    public open(onready: () => void, onrecv: (data: PageData) => void){
        switch(SENDTYPE){
            case SendType.websocket:
                this._ws?.open(onready,onrecv);
                break;
            case SendType.ajax:
                this._ajax?.open(onready, onrecv);
                break;
        }
    }

    public request(pageNumbers: number[]){
        switch(SENDTYPE){
            case SendType.websocket:
                this._ws?.request(pageNumbers);
                break;
            case SendType.ajax:
                this._ajax?.request(pageNumbers);
                break;
        }
    }

    public ready(): boolean{
        switch(SENDTYPE){
            case SendType.websocket:
                if (this._ws == undefined) return false;
                return this._ws.ready();
            case SendType.ajax:
                if (this._ajax == undefined) return false;
                return this._ajax.ready();
        }
    }
}